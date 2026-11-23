// Focus sound: a mix of background sounds that plays during focus time (see "Focus sound" in the
// README). Everything is generated in the browser with the Web Audio API (the browser's built-in
// sound engine): no audio file, nothing downloaded. When and whether it plays is decided in app.js
// (updateFocusSound); this file only makes the sound, mixes it and fades it in and out.
//
// The mix: at most one noise and any number of Ambient sounds, each a layer with its own volume.
// - Noise (brown, pink, white, green): steady, so a few seconds are generated once into an
//   AudioBuffer (a block of samples kept in memory) and looped. The end of the buffer is crossfaded
//   into its start, so the loop point has no click.
// - Ambient (rain, birds, wind, fire, waves, fan, vacuum): generated live, sample by sample, by an
//   AudioWorklet (js/focus-sound-worklet.js, which runs on the browser's audio thread). Every drop,
//   crackle and bird phrase is new, so nothing ever repeats, and nothing is kept in memory.
//
// The chain: every layer has its own gain (its volume); Ambient layers also send their "wet" part to
// one shared reverb (a ConvolverNode with a short room generated in code), so nothing sounds bone-dry.
// Everything meets in the master gain (the Volume slider), then a limiter (in the worklet) that keeps
// the sum from clipping, then the fade gain (fading the whole mix in and out), then the speakers.
// Every start, stop and change is a short gain ramp, never a jump.

const FOCUS_NOISES = ["brown", "pink", "white", "green"];
// In the order of the setup screen's tiles and volume rows. Adding a sound: see the README.
const FOCUS_AMBIENTS = ["rain", "birds", "wind", "fire", "waves", "fan", "vacuum"];
// The worklet next to this file, wherever the page is (the app, or the listening lab in lab/sound/).
const FOCUS_WORKLET_URL = new URL("focus-sound-worklet.js", document.currentScript.src).href;
const FOCUS_VOLUME_DEFAULT = 55; // the master (Volume slider), %
const FOCUS_LAYER_DEFAULT = 70; // a layer turned on for the first time, %
const FOCUS_VOLUME_MIN = 5;
const FOCUS_VOLUME_MAX = 100;
const FOCUS_VOLUME_STEP = 5;
const FOCUS_LAYER_FADE_S = 0.3; // a layer turned on or off, or a noise changed, while the mix plays
const NOISE_SECONDS = 8; // the length of a noise's loop. Long enough that no pattern can be heard.
const NOISE_CROSSFADE_SECONDS = 0.5; // the end blends into the start over this long
const REVERB_SECONDS = 1; // the generated room's length
const REVERB_RETURN = 0.6; // how much of the reverb comes back into the mix
// The level of each layer at 100% (with the master at 100%): for a noise on a buffer at an RMS
// (average level) of 1, for an ambient sound on the worklet's raw output, reverb included. Chosen so
// every layer sounds about equally loud at the same % (measured with A-weighting, which follows how
// ears hear, over a minute of each), and so that 100% is a comfortable background, well under the end
// chime (CHIME_VOLUME in app.js). See the README.
const FOCUS_LEVELS = {
  brown: 0.072, pink: 0.055, white: 0.048, green: 0.047,
  // Matched on the average, like the noises: rain, wind, fan, vacuum. Fire: 5 dB lower on average,
  // because ears judge crackles by their peaks (the usual correction for impulsive sounds). Waves: on
  // their crests (2 dB above the noises), so the troughs are quieter. Birds: on their phrases (2 dB
  // under the noises), so they stay in the background.
  rain: 1.69, birds: 0.41, wind: 0.195, fire: 2.23, waves: 0.34, fan: 0.181, vacuum: 0.258,
};

// Does this browser have Web Audio at all? Without it the Focus sound setting isn't shown.
function focusSoundSupported() {
  return Boolean(window.AudioContext || window.webkitAudioContext);
}

// Can this browser play the Ambient sounds? They need AudioWorklet (Chrome 66+, Safari 14.1+,
// Firefox 76+), which only works on HTTPS (or localhost). Without it the Ambient group isn't shown.
function focusAmbientSupported() {
  return focusSoundSupported() && typeof window.AudioWorkletNode === "function" && window.isSecureContext !== false;
}

// A saved noise from ct_prefs_v1: anything unknown is "off".
function cleanFocusNoise(value) {
  return FOCUS_NOISES.includes(value) ? value : "off";
}

// A saved volume (%): a whole step between the limits, `fallback` if it isn't a number.
function cleanFocusVolume(value, fallback = FOCUS_VOLUME_DEFAULT) {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return fallback;
  const stepped = Math.round(n / FOCUS_VOLUME_STEP) * FOCUS_VOLUME_STEP;
  return Math.min(FOCUS_VOLUME_MAX, Math.max(FOCUS_VOLUME_MIN, stepped));
}

// The saved mixer (focusMix in ct_prefs_v1): { rain: { on: true, volume: 40 }, … }. A sound is in it
// once it has been turned on; turned off, it keeps its volume for next time. Unknown sounds and bad
// values are dropped.
function cleanFocusMix(value) {
  const mix = {};
  if (!value || typeof value !== "object") return mix;
  for (const id of FOCUS_AMBIENTS) {
    const entry = value[id];
    if (!entry || typeof entry !== "object") continue;
    mix[id] = { on: entry.on === true, volume: cleanFocusVolume(entry.volume, FOCUS_LAYER_DEFAULT) };
  }
  return mix;
}

// A layer's gain at a volume in %. Squared, because ears hear loudness that way: 40% then sounds about
// halfway, not nearly as loud as 100%. The master is squared the same way (focusMasterGain).
function focusLayerGain(id, volume) {
  const v = cleanFocusVolume(volume, FOCUS_LAYER_DEFAULT) / 100;
  return (FOCUS_LEVELS[id] || 0) * v * v;
}

function focusMasterGain(volume) {
  const v = cleanFocusVolume(volume) / 100;
  return v * v;
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

// The reverb's room, generated once per AudioContext: a few early reflections (5–60 ms, like nearby
// walls, trees or the ground), then a dense tail that dies away in about 0.7 s, its highs dying
// faster than its lows, as in a real space. Each ear gets its own random room, so it sounds wide.
function makeRoomImpulse(ctx) {
  const sr = ctx.sampleRate;
  const length = Math.round(sr * REVERB_SECONDS);
  const buffer = ctx.createBuffer(2, length, sr);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let k = 0; k < 8; k++) {
      const t = 0.005 + Math.random() * 0.055;
      data[Math.round(t * sr)] += (Math.random() < 0.5 ? -1 : 1) * 0.6 * (1 - t / 0.08);
    }
    let lp = 0;
    for (let i = Math.round(0.01 * sr); i < length; i++) {
      const t = i / sr;
      const a = 0.85 - 0.7 * (t / REVERB_SECONDS); // the low-pass closes as the tail dies
      lp += a * (Math.random() * 2 - 1 - lp);
      const fadeIn = Math.min(1, (t - 0.01) / 0.02);
      data[i] += lp * Math.exp(-t / 0.1) * 0.5 * fadeIn;
    }
  }
  return buffer;
}

// The player. getContext returns the page's AudioContext (made and unlocked by a tap in app.js), or
// null when there's none yet. setMix() says what the mix is; start() fades it in and stop() fades it
// out. While it plays, setMix() and setMaster() change it at once: a layer turned on fades in, one
// turned off fades out, the others play on undisturbed. Stopped, every node is stopped and
// disconnected, so nothing runs while it's silent.
// If the worklet module can't be loaded (an old browser, or a failed download), the noise still plays
// (straight to the master, without the limiter: one noise alone can't clip) and Ambient layers stay
// silent, without errors.
function createFocusSoundPlayer(getContext) {
  // The noise buffer of the noise picked now, "type|sampleRate" → AudioBuffer. Only one is kept:
  // building another drops the old one (a layer that's still fading out keeps its own until it stops).
  const buffers = new Map();
  const modules = new WeakMap(); // ctx → promise: true once the worklet is loaded, false if it can't be
  const rooms = new WeakMap(); // ctx → the reverb's impulse (AudioBuffer)
  // noise: "off" or a noise; ambients: { id: volume } of the Ambient layers that are on.
  // variants: only the listening lab uses it ({ rain: "b" }).
  let mix = { noise: "off", noiseVolume: FOCUS_LAYER_DEFAULT, ambients: {}, variants: {} };
  let master = FOCUS_VOLUME_DEFAULT;
  let want = false; // start() was called, and stop() not since
  let pending = null; // a start waiting for the worklet module
  let chain = null; // the mix that's playing (or fading out)

  const loadModule = (ctx) => {
    if (!focusAmbientSupported() || !ctx.audioWorklet) return Promise.resolve(false);
    if (!modules.has(ctx)) {
      const loading = ctx.audioWorklet.addModule(FOCUS_WORKLET_URL).then(
        () => true,
        () => {
          modules.delete(ctx); // tried again next time
          return false;
        },
      );
      modules.set(ctx, loading);
    }
    return modules.get(ctx);
  };

  // From the param's value right now to target, in a straight line over seconds. The ramp needs a
  // starting point at "now": without one it would start from the end of the last ramp, so a fade
  // that begins long after the previous one ended would jump halfway down at once.
  const rampTo = (param, ctx, target, seconds) => {
    const now = ctx.currentTime;
    const current = param.value; // read before cancelling: it's where a ramp under way has got to
    if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
    else param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
    param.linearRampToValueAtTime(target, now + Math.max(0.01, seconds));
  };

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

  // The shared reverb, made when the first Ambient layer joins: Ambient layers' wet outputs →
  // wetBus → convolver → master.
  const ensureReverb = (c) => {
    if (c.wetBus) return;
    if (!rooms.has(c.ctx)) rooms.set(c.ctx, makeRoomImpulse(c.ctx));
    c.convolver = c.ctx.createConvolver();
    c.convolver.buffer = rooms.get(c.ctx);
    c.wetBus = c.ctx.createGain();
    c.wetBus.gain.value = REVERB_RETURN;
    c.wetBus.connect(c.convolver);
    c.convolver.connect(c.master);
  };

  const buildChain = (ctx, withWorklet) => {
    const c = { ctx, withWorklet, layers: new Map(), stopping: false, limiter: null, wetBus: null, convolver: null };
    c.fade = ctx.createGain();
    c.fade.gain.value = 0;
    c.fade.connect(ctx.destination);
    c.master = ctx.createGain();
    c.master.gain.value = focusMasterGain(master);
    if (withWorklet) {
      try {
        c.limiter = new AudioWorkletNode(ctx, "focus-limiter", {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit",
        });
        c.master.connect(c.limiter);
        c.limiter.connect(c.fade);
      } catch {
        c.limiter = null;
        c.withWorklet = false;
      }
    }
    if (!c.limiter) c.master.connect(c.fade);
    return c;
  };

  // A new layer, its gain ramping from 0 to its volume over fadeSeconds.
  const startLayer = (c, id, volume, fadeSeconds) => {
    const { ctx } = c;
    const layer = { id, volume, variant: mix.variants[id] || "", stopping: false, gains: [] };
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(c.master);
      layer.gains.push(gain);
      if (FOCUS_NOISES.includes(id)) {
        const source = ctx.createBufferSource();
        source.buffer = bufferFor(ctx, id);
        source.loop = true;
        source.connect(gain);
        source.start(0, Math.random() * NOISE_SECONDS); // a random place in the loop: every start sounds fresh
        layer.source = source;
      } else {
        if (!c.withWorklet) {
          gain.disconnect();
          return null; // no worklet: this layer stays silent
        }
        ensureReverb(c);
        const node = new AudioWorkletNode(ctx, "focus-ambient", {
          numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [2, 2],
          processorOptions: { type: id, variant: layer.variant },
        });
        const wetGain = ctx.createGain();
        wetGain.gain.value = 0;
        wetGain.connect(c.wetBus);
        node.connect(gain, 0);
        node.connect(wetGain, 1);
        layer.gains.push(wetGain);
        layer.node = node;
      }
    } catch {
      layer.gains.forEach((g) => g.disconnect());
      return null; // no sound for this layer: the app works the same
    }
    const target = focusLayerGain(id, volume);
    layer.gains.forEach((g) => rampTo(g.gain, ctx, target, fadeSeconds));
    return layer;
  };

  // Stops a layer at the audio clock time `end` (its gain already fading, or the whole mix fading),
  // then disconnects it.
  const endLayer = (c, layer, end) => {
    layer.stopping = true;
    const disconnect = () => layer.gains.forEach((g) => g.disconnect());
    if (layer.source) {
      try {
        layer.source.stop(end);
      } catch {
        // already stopped
      }
      layer.source.onended = disconnect;
    } else if (layer.node) {
      layer.node.port.onmessage = () => {
        layer.node.disconnect();
        disconnect();
      };
      layer.node.port.postMessage({ stopAt: end });
    }
  };

  const fadeOutLayer = (c, layer, fadeSeconds) => {
    layer.gains.forEach((g) => rampTo(g.gain, c.ctx, 0, fadeSeconds));
    endLayer(c, layer, c.ctx.currentTime + fadeSeconds + 0.05);
  };

  // Makes the chain's layers match the mix: new ones fade in, removed ones fade out, a changed volume
  // follows within a moment. A noise changed to another noise crossfades.
  const applyMix = (c, fadeSeconds) => {
    const wanted = new Map();
    if (mix.noise !== "off") wanted.set(mix.noise, mix.noiseVolume);
    for (const id of FOCUS_AMBIENTS) if (id in mix.ambients) wanted.set(id, mix.ambients[id]);
    for (const [id, layer] of c.layers) {
      if (!wanted.has(id) || layer.variant !== (mix.variants[id] || "")) {
        fadeOutLayer(c, layer, fadeSeconds);
        c.layers.delete(id);
      }
    }
    for (const [id, volume] of wanted) {
      const layer = c.layers.get(id);
      if (!layer) {
        const added = startLayer(c, id, volume, fadeSeconds);
        if (added) c.layers.set(id, added);
      } else if (layer.volume !== volume) {
        layer.volume = volume;
        layer.gains.forEach((g) => rampTo(g.gain, c.ctx, focusLayerGain(id, volume), 0.08));
      }
    }
  };

  // The whole mix fades out, then every node stops and is disconnected. A silent one-sample clock
  // tells when the fade is over.
  const stopChain = (c, fadeSeconds) => {
    c.stopping = true;
    const { ctx } = c;
    rampTo(c.fade.gain, ctx, 0, fadeSeconds);
    const end = ctx.currentTime + fadeSeconds + 0.05;
    for (const layer of c.layers.values()) endLayer(c, layer, end);
    if (c.limiter) c.limiter.port.postMessage({ stopAt: end + 0.02 });
    const clock = ctx.createBufferSource();
    clock.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    clock.connect(c.fade);
    clock.onended = () => {
      clock.disconnect();
      // The limiter's own "ended" comes a moment later; disconnecting it now is fine either way.
      [c.wetBus, c.convolver, c.master, c.limiter, c.fade].forEach((node) => node && node.disconnect());
    };
    clock.start(end + 0.03);
  };

  return {
    // What the mix is: { noise: "off" | a noise, noiseVolume, ambients: { id: volume }, variants }.
    // Applied at once if it's playing.
    setMix(next) {
      mix = {
        noise: cleanFocusNoise(next.noise),
        noiseVolume: cleanFocusVolume(next.noiseVolume, FOCUS_LAYER_DEFAULT),
        ambients: {},
        variants: { ...(next.variants || {}) },
      };
      for (const id of FOCUS_AMBIENTS) {
        if (next.ambients && id in next.ambients) mix.ambients[id] = cleanFocusVolume(next.ambients[id], FOCUS_LAYER_DEFAULT);
      }
      if (chain && !chain.stopping) applyMix(chain, FOCUS_LAYER_FADE_S);
    },
    // The master volume (%), followed within a moment if it's playing.
    setMaster(percent) {
      master = cleanFocusVolume(percent);
      if (chain && !chain.stopping) rampTo(chain.master.gain, chain.ctx, focusMasterGain(master), 0.08);
    },
    // Fades the whole mix in over fadeSeconds (or back in, if it was fading out). Already playing:
    // nothing changes. The first start waits a moment for the worklet module to load.
    start(fadeSeconds) {
      const ctx = getContext();
      if (!ctx) return;
      want = true;
      if (chain && !chain.stopping && chain.ctx === ctx) {
        rampTo(chain.fade.gain, ctx, 1, fadeSeconds);
        return;
      }
      if (pending) return;
      const token = {};
      pending = token;
      loadModule(ctx).then((ok) => {
        if (pending !== token) return; // stopped (or started again) meanwhile
        pending = null;
        if (!want) return;
        // A mix that's still fading out finishes on its own; the new one fades in over it.
        chain = buildChain(ctx, ok);
        applyMix(chain, 0);
        rampTo(chain.fade.gain, ctx, 1, fadeSeconds);
      });
    },
    // Fades the whole mix out over fadeSeconds, then stops everything. Not playing: nothing happens.
    stop(fadeSeconds) {
      want = false;
      pending = null;
      if (chain && !chain.stopping) stopChain(chain, fadeSeconds);
    },
    // Playing (or fading in, or about to), not fading out or stopped.
    playing() {
      return want && Boolean(pending || (chain && !chain.stopping));
    },
  };
}
