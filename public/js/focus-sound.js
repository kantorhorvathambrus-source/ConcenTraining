// Focus sound: a steady background sound that plays during focus time (see "Focus sound" in the
// README). Everything is generated in the browser with the Web Audio API (the browser's built-in
// sound engine): no audio file, nothing downloaded. When and whether it plays is decided in app.js
// (updateFocusSound); this file only makes the sound and fades it in and out.
//
// Two kinds:
// - Noise (brown, pink, white, green): steady, so a few seconds are generated once into an
//   AudioBuffer (a block of samples kept in memory) and looped. The end of the buffer is crossfaded
//   into its start, so the loop point has no click.
// - Ambient (waves, rain, fire, fan, vacuum): generated live, sample by sample, by an AudioWorklet
//   (js/focus-sound-worklet.js, which runs on the browser's audio thread). Every wave, drop and
//   crackle is new, so nothing ever repeats, and nothing is kept in memory.
// Both play through a GainNode (a volume knob), and every start, stop and change is a short gain
// ramp, never a jump.

const FOCUS_NOISES = ["brown", "pink", "white", "green"];
const FOCUS_AMBIENTS = ["waves", "rain", "fire", "fan", "vacuum"];
const FOCUS_SOUNDS = [...FOCUS_NOISES, ...FOCUS_AMBIENTS]; // and "off": no sound
const FOCUS_WORKLET_URL = "js/focus-sound-worklet.js"; // relative: works under a subpath too
const FOCUS_VOLUME_DEFAULT = 40; // %
const FOCUS_VOLUME_MIN = 5;
const FOCUS_VOLUME_MAX = 100;
const FOCUS_VOLUME_STEP = 5;
const NOISE_SECONDS = 8; // the length of a noise's loop. Long enough that no pattern can be heard.
const NOISE_CROSSFADE_SECONDS = 0.5; // the end blends into the start over this long
// The level of each sound at 100%: for a noise on a buffer at an RMS (average level) of 1, for an
// ambient sound on the worklet's raw output. Chosen so they all sound about equally loud (measured
// with A-weighting, which follows how ears hear, over a minute of each), and so that 100% is a
// comfortable background, well under the end chime (CHIME_VOLUME in app.js). See the README.
const NOISE_LEVELS = {
  brown: 0.072, pink: 0.055, white: 0.048, green: 0.047,
  // Waves: matched on the crests (a little above the noises), so the troughs are quieter.
  waves: 0.32, rain: 0.21, fire: 0.47, fan: 0.17, vacuum: 0.24,
};

// Does this browser have Web Audio at all? Without it the Focus sound setting isn't shown.
function focusSoundSupported() {
  return Boolean(window.AudioContext || window.webkitAudioContext);
}

// Can this browser play this sound? The ambient ones need AudioWorklet (Chrome 66+, Safari 14.1+,
// Firefox 76+), and only work on HTTPS (or localhost). Without it their chips aren't shown.
function focusSoundTypeSupported(type) {
  if (!focusSoundSupported() || !FOCUS_SOUNDS.includes(type)) return false;
  if (!FOCUS_AMBIENTS.includes(type)) return true;
  return typeof window.AudioWorkletNode === "function" && window.isSecureContext !== false;
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

// A two-pole filter (the RBJ "audio EQ cookbook" biquad), "lowpass" or "highpass", as a function
// that takes one sample and returns one.
function biquad(kind, hz, q, sampleRate) {
  const w0 = (2 * Math.PI * hz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  const b0 = (kind === "lowpass" ? (1 - cos) / 2 : (1 + cos) / 2) / a0;
  const b1 = (kind === "lowpass" ? 1 - cos : -(1 + cos)) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

// One channel of noise, `length` samples long (normalised later, in generateNoise).
//   white: every sample random, all frequencies equally strong (the brightest).
//   pink:  Paul Kellet's filter on white noise: each octave equally strong (softer, like rain).
//   brown: white noise run through a leaky integrator, so low frequencies dominate (the deepest,
//          like a distant waterfall), with a 20 Hz high-pass so no inaudible rumble eats headroom.
//   green: pink noise through a gentle band (a 180 Hz high-pass and a 1400 Hz low-pass, both soft),
//          so the middle frequencies around 500 Hz dominate: softer than pink, like a forest.
// The extra samples past the loop length are what the start is crossfaded with (see generateNoise).
function noiseChannel(type, sampleRate, length) {
  const out = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; // pink filter state
  let brown = 0; // the leaky integrator
  let lastIn = 0, lastOut = 0; // the high-pass
  const leak = 0.02 * (44100 / sampleRate); // the same deep sound at 44.1 and 48 kHz
  const hp = 1 - (2 * Math.PI * 20) / sampleRate;
  const greenHp = biquad("highpass", 180, 0.6, sampleRate);
  const greenLp = biquad("lowpass", 1400, 0.6, sampleRate);
  // A few seconds run first and are thrown away, so the filters have settled when the loop starts.
  const warmup = Math.round(sampleRate * 2);
  for (let i = -warmup; i < length; i++) {
    const white = Math.random() * 2 - 1;
    let x = white;
    if (type === "pink" || type === "green") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      x = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      if (type === "green") x = greenLp(greenHp(x));
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
// to another sound), stop() fades it out and then stops it, so nothing runs while it's silent.
// Every call can come at any moment, also in the middle of another fade: the new ramp starts from
// wherever the old one had got to.
function createFocusSoundPlayer(getContext) {
  // The noise buffer of the sound picked now, "type|sampleRate" → AudioBuffer. Only one is kept:
  // building another drops the old one (a voice that's still fading out keeps its own until it
  // stops), so there are never more than two in memory, and only during a crossfade.
  const buffers = new Map();
  // The worklet module, loaded once per AudioContext (the first time an ambient sound plays):
  // ctx → a promise that resolves once it's loaded. A failed load is forgotten, so it's tried again.
  const worklets = new WeakMap();
  let voice = null; // { ctx, type, source, gain, stopping }
  let volume = FOCUS_VOLUME_DEFAULT;

  const bufferFor = (ctx, type) => {
    const key = `${type}|${ctx.sampleRate}`;
    if (!buffers.has(key)) {
      buffers.clear();
      const data = generateNoise(type, ctx.sampleRate, 2);
      const buffer = ctx.createBuffer(data.length, data[0].length, ctx.sampleRate);
      data.forEach((channel, c) => buffer.getChannelData(c).set(channel));
      buffers.set(key, buffer);
    }
    return buffers.get(key);
  };

  const loadWorklet = (ctx) => {
    if (!worklets.has(ctx)) {
      const loading = ctx.audioWorklet.addModule(FOCUS_WORKLET_URL).then(
        () => true,
        () => {
          worklets.delete(ctx);
          return false;
        },
      );
      worklets.set(ctx, loading);
    }
    return worklets.get(ctx);
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

  // A buffer source is stopped once the fade is over; a worklet node is told when to stop and
  // reports back ("ended"). An ambient voice whose module hasn't loaded yet has no source at all.
  const fadeOut = (v, seconds) => {
    v.stopping = true;
    rampTo(v.gain, v.ctx, 0, seconds);
    const end = v.ctx.currentTime + seconds + 0.05;
    if (!v.source) {
      v.gain.disconnect();
    } else if (v.source.port) {
      v.source.port.onmessage = () => {
        v.source.disconnect();
        v.gain.disconnect();
      };
      v.source.port.postMessage({ stopAt: end });
    } else {
      try {
        v.source.stop(end);
      } catch {
        // already stopped
      }
      v.source.onended = () => v.gain.disconnect();
    }
  };

  // The ambient sound's node, once the module is loaded. If the voice was stopped or replaced while
  // it loaded, nothing is made. The fade starts now, not when play() was called, so a first load
  // that takes a moment still fades in from silence.
  const attachAmbient = (v, fadeSeconds) => {
    if (voice !== v || v.stopping) return;
    try {
      v.source = new AudioWorkletNode(v.ctx, "focus-ambient", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { type: v.type },
      });
      v.source.connect(v.gain);
      rampTo(v.gain, v.ctx, focusGain(v.type, volume), fadeSeconds);
    } catch {
      v.gain.disconnect();
      if (voice === v) voice = null; // no sound: the app works the same
    }
  };

  return {
    // Fades the sound in to the current volume over fadeSeconds. Already playing this type: only
    // the level follows. Another type: the old one fades out (over at most 0.6 s) while the new
    // one fades in. One that is fading out finishes its fade on its own: a source can't be started
    // again once its stop is scheduled, so a new one fades in over it, without a gap.
    play(type, fadeSeconds) {
      const ctx = getContext();
      if (!ctx || !focusSoundTypeSupported(type)) return;
      if (voice && !voice.stopping) {
        if (voice.ctx === ctx && voice.type === type) {
          if (voice.source) rampTo(voice.gain, ctx, focusGain(type, volume), fadeSeconds);
          return;
        }
        fadeOut(voice, Math.min(fadeSeconds, 0.6));
      }
      try {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(ctx.destination);
        const v = { ctx, type, source: null, gain, stopping: false };
        voice = v;
        if (FOCUS_AMBIENTS.includes(type)) {
          loadWorklet(ctx).then((ok) => (ok ? attachAmbient(v, fadeSeconds) : fadeOut(v, 0)));
          return;
        }
        const source = ctx.createBufferSource();
        source.buffer = bufferFor(ctx, type);
        source.loop = true;
        source.connect(gain);
        // A random place in the loop, so every start sounds fresh.
        source.start(0, Math.random() * NOISE_SECONDS);
        v.source = source;
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
      if (voice && voice.source && !voice.stopping) {
        rampTo(voice.gain, voice.ctx, focusGain(voice.type, volume), 0.08);
      }
    },
    // Playing (or fading in, or about to), not fading out or stopped.
    playing() {
      return Boolean(voice && !voice.stopping);
    },
  };
}
