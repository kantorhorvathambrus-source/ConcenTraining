// Focus sound: a steady brown, pink or white noise that plays during focus time (see "Focus sound"
// in the README). Generated in the browser with the Web Audio API (the browser's built-in sound
// engine): no audio file, nothing downloaded. When and whether it plays is decided in app.js
// (updateFocusSound); this file only makes the sound and fades it in and out.
//
// How: a few seconds of noise are generated once per type into an AudioBuffer (a block of samples
// kept in memory) and looped through a GainNode (a volume knob). The end of the buffer is
// crossfaded into its start, so the loop point has no click, and every start, stop and change
// is a short gain ramp, never a jump.

const FOCUS_SOUNDS = ["brown", "pink", "white"]; // "off" is the fourth choice: no sound
const FOCUS_VOLUME_DEFAULT = 40; // %
const FOCUS_VOLUME_MIN = 5;
const FOCUS_VOLUME_MAX = 100;
const FOCUS_VOLUME_STEP = 5;
const NOISE_SECONDS = 8; // the length of the loop. Long enough that no pattern can be heard.
const NOISE_CROSSFADE_SECONDS = 0.5; // the end blends into the start over this long
// The level of each noise at 100%, on noise generated at an RMS (average level) of 1. Chosen so
// the three sound about equally loud (measured with A-weighting, which follows how ears hear),
// and so that 100% is a comfortable background, well under the end chime (CHIME_VOLUME in app.js).
const NOISE_LEVELS = { brown: 0.072, pink: 0.055, white: 0.048 };

// Does this browser have Web Audio at all? Without it the Focus sound setting isn't shown.
function focusSoundSupported() {
  return Boolean(window.AudioContext || window.webkitAudioContext);
}

// A saved choice from ct_prefs_v1: anything unknown (or prefs saved before it existed) is "off".
function cleanFocusSound(value) {
  return FOCUS_SOUNDS.includes(value) ? value : "off";
}

// A saved volume (%): a whole step between the limits, FOCUS_VOLUME_DEFAULT if it isn't a number.
function cleanFocusVolume(value) {
  const n = Number(value);
  if (value === null || value === "" || !Number.isFinite(n)) return FOCUS_VOLUME_DEFAULT;
  const stepped = Math.round(n / FOCUS_VOLUME_STEP) * FOCUS_VOLUME_STEP;
  return Math.min(FOCUS_VOLUME_MAX, Math.max(FOCUS_VOLUME_MIN, stepped));
}

// The gain for a volume in %. Squared, because ears hear loudness that way: 40% then sounds about
// halfway, not nearly as loud as 100%.
function focusGain(type, volume) {
  const v = cleanFocusVolume(volume) / 100;
  return (NOISE_LEVELS[type] || 0) * v * v;
}

// One channel of noise, `length` samples long, at an RMS of 1.
//   white: every sample random, all frequencies equally strong (the brightest).
//   pink:  Paul Kellet's filter on white noise: each octave equally strong (softer, like rain).
//   brown: white noise run through a leaky integrator, so low frequencies dominate (the deepest,
//          like a distant waterfall), with a 20 Hz high-pass so no inaudible rumble eats headroom.
// The extra samples past the loop length are what the start is crossfaded with (see generateNoise).
function noiseChannel(type, sampleRate, length) {
  const out = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; // pink filter state
  let brown = 0; // the leaky integrator
  let lastIn = 0, lastOut = 0; // the high-pass
  const leak = 0.02 * (44100 / sampleRate); // the same deep sound at 44.1 and 48 kHz
  const hp = 1 - (2 * Math.PI * 20) / sampleRate;
  // A few seconds run first and are thrown away, so the filters have settled when the loop starts.
  const warmup = Math.round(sampleRate * 2);
  for (let i = -warmup; i < length; i++) {
    const white = Math.random() * 2 - 1;
    let x = white;
    if (type === "pink") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      x = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    } else if (type === "brown") {
      brown = (brown + leak * white) / (1 + leak);
      const y = brown - lastIn + hp * lastOut;
      lastIn = brown;
      lastOut = y;
      x = y;
    }
    if (i >= 0) out[i] = x;
  }
  return out;
}

// The loop: `channels` channels of NOISE_SECONDS each, every channel its own random noise (stereo
// sounds wider and calmer on headphones), normalised to an RMS of 1. The first
// NOISE_CROSSFADE_SECONDS fade from the samples that follow the loop's end into the loop's own,
// with an equal-power curve (no dip in loudness). So when the loop jumps from its last sample back
// to its first, the sound carries on as if it had never jumped.
function generateNoise(type, sampleRate, channels) {
  const length = Math.round(sampleRate * NOISE_SECONDS);
  const fade = Math.round(sampleRate * NOISE_CROSSFADE_SECONDS);
  const data = [];
  for (let c = 0; c < channels; c++) {
    const raw = noiseChannel(type, sampleRate, length + fade);
    const loop = raw.subarray(0, length);
    for (let i = 0; i < fade; i++) {
      const w = (i / fade) * (Math.PI / 2);
      loop[i] = raw[i] * Math.sin(w) + raw[length + i] * Math.cos(w);
    }
    let sum = 0;
    for (let i = 0; i < length; i++) sum += loop[i] * loop[i];
    const scale = 1 / Math.sqrt(sum / length || 1);
    for (let i = 0; i < length; i++) loop[i] *= scale;
    data.push(loop);
  }
  return data;
}

// The player. getContext returns the page's AudioContext (made and unlocked by a tap in app.js),
// or null when there's none yet. One voice at a time: play() fades it in (or back in, or crossfades
// to another noise), stop() fades it out and then stops it, so nothing runs while it's silent.
// Every call can come at any moment, also in the middle of another fade: the new ramp starts from
// wherever the old one had got to.
function createFocusSoundPlayer(getContext) {
  const buffers = new Map(); // "type|sampleRate" → AudioBuffer, built the first time it's needed
  let voice = null; // { ctx, type, source, gain, stopping }
  let volume = FOCUS_VOLUME_DEFAULT;

  const bufferFor = (ctx, type) => {
    const key = `${type}|${ctx.sampleRate}`;
    if (!buffers.has(key)) {
      const data = generateNoise(type, ctx.sampleRate, 2);
      const buffer = ctx.createBuffer(data.length, data[0].length, ctx.sampleRate);
      data.forEach((channel, c) => buffer.getChannelData(c).set(channel));
      buffers.set(key, buffer);
    }
    return buffers.get(key);
  };

  // From the gain's value right now to target, in a straight line over seconds. The ramp needs a
  // starting point at "now": without one it would start from the end of the last ramp, so a fade
  // that begins long after the previous one ended would jump halfway down at once.
  const rampTo = (gain, ctx, target, seconds) => {
    const now = ctx.currentTime;
    const param = gain.gain;
    const current = param.value; // read before cancelling: it's where a ramp under way has got to
    if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
    else param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
    param.linearRampToValueAtTime(target, now + Math.max(0.01, seconds));
  };

  const fadeOut = (v, seconds) => {
    v.stopping = true;
    rampTo(v.gain, v.ctx, 0, seconds);
    try {
      v.source.stop(v.ctx.currentTime + seconds + 0.05);
    } catch {
      // already stopped
    }
    v.source.onended = () => v.gain.disconnect();
  };

  return {
    // Fades the noise in to the current volume over fadeSeconds. Already playing this type: only
    // the level follows. Another type: the old one fades out (over at most 0.6 s) while the new
    // one fades in. One that is fading out finishes its fade on its own: a source can't be started
    // again once its stop is scheduled, so a new one fades in over it, without a gap.
    play(type, fadeSeconds) {
      const ctx = getContext();
      if (!ctx || !FOCUS_SOUNDS.includes(type)) return;
      if (voice && !voice.stopping) {
        if (voice.ctx === ctx && voice.type === type) {
          rampTo(voice.gain, ctx, focusGain(type, volume), fadeSeconds);
          return;
        }
        fadeOut(voice, Math.min(fadeSeconds, 0.6));
      }
      try {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(ctx.destination);
        const source = ctx.createBufferSource();
        source.buffer = bufferFor(ctx, type);
        source.loop = true;
        source.connect(gain);
        // A random place in the loop, so every start sounds fresh.
        source.start(0, Math.random() * NOISE_SECONDS);
        voice = { ctx, type, source, gain, stopping: false };
        rampTo(gain, ctx, focusGain(type, volume), fadeSeconds);
      } catch {
        voice = null; // no sound: the app works the same
      }
    },
    // Fades out over fadeSeconds, then the source stops. Nothing playing: nothing happens.
    stop(fadeSeconds) {
      if (!voice || voice.stopping) return;
      fadeOut(voice, fadeSeconds);
    },
    // A new volume (%), followed within a moment if it's playing. The next play() uses it too.
    setVolume(percent) {
      volume = cleanFocusVolume(percent);
      if (voice && !voice.stopping) rampTo(voice.gain, voice.ctx, focusGain(voice.type, volume), 0.08);
    },
    // Playing (or fading in), not fading out or stopped.
    playing() {
      return Boolean(voice && !voice.stopping);
    },
  };
}
