// The Ambient focus sounds (Rain, Birds, Wind, Waves, Crickets, Fan, Vacuum), generated live, sample
// by sample, and the limiter that keeps the whole mix from clipping. This is an AudioWorklet module: it
// runs on the browser's audio thread, not on the page, and is loaded by focus-sound.js
// (audioWorklet.addModule). See "Focus sound" in the README.
//
// Why live and not a loop: every drop, chirp, bird phrase and wave is rolled from random numbers as
// it plays, so nothing ever repeats, however long the session. It needs no memory for samples, and
// it runs exactly as long as the page's audio does (with the screen locked too, where the browser
// keeps audio playing): no timers, which browsers pause in the background.
//
// Every sound writes four values per sample: dry left and right, and wet left and right (the part
// that goes to the shared reverb in focus-sound.js). So a single drop or bird can sound far away
// (quieter, duller, wetter) or close (louder, brighter, drier).
//
// Each sound comes out at roughly the same raw level; focus-sound.js (FOCUS_LEVELS) sets the final
// level, matched to the noises. This file has no access to the page or its other scripts.
//
// Adding a sound: a class with next(out) here, an entry in SOUNDS below, and the steps in the README.

const TWO_PI = 2 * Math.PI;

function white() {
  return Math.random() * 2 - 1;
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// A sine table (4096 points, read with linear interpolation): far cheaper than Math.sin on every
// sample, and accurate to about 1e-7, so it sounds exactly the same. x in radians, any sign.
const SINE_SIZE = 4096;
const SINE = new Float64Array(SINE_SIZE + 1);
for (let i = 0; i <= SINE_SIZE; i++) SINE[i] = Math.sin((TWO_PI * i) / SINE_SIZE);

function fastSin(x) {
  const t = x * (SINE_SIZE / TWO_PI);
  const i = Math.floor(t);
  const j = i & (SINE_SIZE - 1);
  return SINE[j] + (SINE[j + 1] - SINE[j]) * (t - i);
}

function fastCos(x) {
  return fastSin(x + Math.PI / 2);
}

// A soft limit: about c·tanh(x/c), smooth and continuous, within about 2% of the real curve but far
// cheaper than Math.tanh on every sample. Nearly straight for small x; never beyond ±c.
function softClip(x, c) {
  const u = x / c;
  if (u >= 3) return c;
  if (u <= -3) return -c;
  const u2 = u * u;
  return (c * u * (27 + u2)) / (27 + 9 * u2);
}

// Paul Kellet's pink filter (as in focus-sound.js). next(white) returns pink noise, RMS about 0.3.
class Pink {
  constructor() {
    this.b = [0, 0, 0, 0, 0, 0, 0];
  }

  next(w) {
    const b = this.b;
    b[0] = 0.99886 * b[0] + w * 0.0555179;
    b[1] = 0.99332 * b[1] + w * 0.0750759;
    b[2] = 0.969 * b[2] + w * 0.153852;
    b[3] = 0.8665 * b[3] + w * 0.3104856;
    b[4] = 0.55 * b[4] + w * 0.5329522;
    b[5] = -0.7616 * b[5] - w * 0.016898;
    const out = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362;
    b[6] = w * 0.115926;
    return out * 0.3;
  }
}

// White noise through a leaky integrator and a 20 Hz high-pass (as in focus-sound.js), RMS about 0.3.
class Brown {
  constructor() {
    this.leak = 0.02 * (44100 / sampleRate);
    this.hp = 1 - (TWO_PI * 20) / sampleRate;
    this.y = 0;
    this.lastIn = 0;
    this.lastOut = 0;
  }

  next(w) {
    this.y = (this.y + this.leak * w) / (1 + this.leak);
    const out = this.y - this.lastIn + this.hp * this.lastOut;
    this.lastIn = this.y;
    this.lastOut = out;
    return out * 2.4;
  }
}

// A one-pole low-pass (6 dB per octave): soft, never resonant. set() can change it while playing.
class OnePole {
  constructor(hz) {
    this.y = 0;
    this.set(hz);
  }

  set(hz) {
    this.a = 1 - Math.exp((-TWO_PI * hz) / sampleRate);
  }

  next(x) {
    this.y += this.a * (x - this.y);
    return this.y;
  }
}

// A two-pole filter (the RBJ "audio EQ cookbook" biquad): "lowpass", "highpass" or "bandpass" (the
// band-pass with 0 dB at its centre). set() can move it while playing.
class Biquad {
  constructor(kind, hz, q) {
    this.kind = kind;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
    this.set(hz, q);
  }

  set(hz, q) {
    const w0 = (TWO_PI * hz) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cos = Math.cos(w0);
    let b0, b1, b2;
    if (this.kind === "lowpass") {
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0;
    } else if (this.kind === "highpass") {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0;
    } else {
      b0 = alpha; b1 = 0; b2 = -alpha;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0; this.a2 = (1 - alpha) / a0;
  }

  next(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// A value that wanders slowly and smoothly between lo and hi: a new random target every minS–maxS
// seconds, glided to with a cosine curve (no corners, so it never sounds like a step).
class Drift {
  constructor(lo, hi, minS, maxS) {
    Object.assign(this, { lo, hi, minS, maxS });
    this.from = rand(lo, hi);
    this.to = this.from;
    this.left = 0;
    this.length = 1;
    this.value = this.from;
  }

  next() {
    if (this.left <= 0) {
      this.from = this.value;
      this.to = rand(this.lo, this.hi);
      this.length = Math.round(rand(this.minS, this.maxS) * sampleRate);
      this.left = this.length;
    }
    this.left--;
    const p = 1 - this.left / this.length;
    this.value = this.from + (this.to - this.from) * (0.5 - 0.5 * fastCos(Math.PI * p));
    return this.value;
  }
}

// Left/right gains for a position from -1 (left) to 1 (right), equal power.
function panGains(pan) {
  const angle = ((pan + 1) * Math.PI) / 4;
  return [Math.cos(angle) * Math.SQRT2, Math.sin(angle) * Math.SQRT2];
}

// The time until the next random event at `perSecond` events per second on average (a Poisson
// process: as irregular as real raindrops, never a rhythm), in samples.
function nextGap(perSecond) {
  return Math.max(1, Math.round((-Math.log(1 - Math.random()) / Math.max(perSecond, 1e-6)) * sampleRate));
}

// Short resonant bursts: raindrops, leaf rustle, foam. Each burst is a little noise with its
// own attack and decay, rung through its own band-pass filter (random centre and Q: a high Q rings
// like a hard surface, a low Q is a soft tap), placed somewhere between left and right, with its own
// share of reverb. A fixed pool, so nothing is created while playing; when it's full, a new burst
// simply isn't played. Active bursts are kept at the front of the pool, so only they are visited.
class Bursts {
  constructor(size) {
    this.pool = Array.from({ length: size }, () => ({
      amp: 0, env: 0, attackLeft: 0, attackStep: 0, decay: 0, tail: 0,
      b0: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0, gl: 0, gr: 0, wet: 0,
    }));
    this.count = 0;
  }

  // hz/q: the band-pass. attackS/decayS: the noise's envelope (decay = time to fall to 1/e).
  // pan: -1..1. wet: 0..1, the share sent to the reverb.
  add(amp, hz, q, attackS, decayS, pan, wet) {
    if (this.count >= this.pool.length) return;
    const b = this.pool[this.count++];
    const w0 = (TWO_PI * Math.min(hz, sampleRate * 0.45)) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    b.b0 = alpha / a0;
    b.a1 = (-2 * Math.cos(w0)) / a0;
    b.a2 = (1 - alpha) / a0;
    b.x1 = 0; b.x2 = 0; b.y1 = 0; b.y2 = 0;
    // A narrow band passes less noise: louder for a high Q, so loudness doesn't depend on the colour.
    b.amp = amp * Math.sqrt(q);
    const attack = Math.max(1, Math.round(attackS * sampleRate));
    b.attackLeft = attack;
    b.attackStep = 1 / attack;
    b.env = 0;
    b.decay = Math.exp(-1 / (decayS * sampleRate));
    // The filter keeps ringing a little after the noise has died away.
    b.tail = Math.round((q / (Math.PI * hz) * 4 + 0.001) * sampleRate);
    const [gl, gr] = panGains(pan);
    b.gl = gl; b.gr = gr; b.wet = wet;
  }

  // Adds every active burst's next sample to out (dry L, dry R, wet L, wet R).
  mix(out) {
    let i = 0;
    while (i < this.count) {
      const b = this.pool[i];
      if (b.attackLeft > 0) {
        b.env += b.attackStep;
        b.attackLeft--;
      } else {
        b.env *= b.decay;
      }
      const x = b.env > 0.003 ? white() * b.env : 0;
      const y = b.b0 * (x - b.x2) - b.a1 * b.y1 - b.a2 * b.y2;
      b.x2 = b.x1; b.x1 = x;
      b.y2 = b.y1; b.y1 = y;
      const s = y * b.amp;
      const dry = 1 - b.wet;
      out[0] += s * b.gl * dry;
      out[1] += s * b.gr * dry;
      out[2] += s * b.gl * b.wet;
      out[3] += s * b.gr * b.wet;
      if (b.env <= 0.003 && --b.tail <= 0) {
        // Finished: the last active burst takes its place.
        this.count--;
        this.pool[i] = this.pool[this.count];
        this.pool[this.count] = b;
      } else {
        i++;
      }
    }
  }
}

// ---------- Rain ----------

// Rain: drops over a steady hiss shaped like rain (about 1–8 kHz, which never swells), no wind-like
// bed and no tones. The drops come at three distances:
//   far:  many, quiet, duller (a lower, softer band) and wetter.
//   mid:  fewer, a little louder and brighter.
//   near: few, louder, brighter, drier: single drops on leaves, the ground or a roof.
// Every drop has its own colour (band-pass centre and Q), attack, decay and place. The rain's
// strength drifts only slowly and slightly (±10% over about a minute): no gusts.
const RAIN = { far: 250, mid: 110, near: 9, hiss: 0.06 };

class Rain {
  constructor() {
    this.far = new Bursts(48);
    this.near = new Bursts(48);
    this.farLp = [new OnePole(5000), new OnePole(5000)];
    this.strength = new Drift(0.9, 1.1, 30, 70);
    this.gaps = { far: nextGap(RAIN.far), mid: nextGap(RAIN.mid), near: nextGap(RAIN.near) };
    this.farOut = [0, 0, 0, 0];
    this.hissHp = [new Biquad("highpass", 1000, 0.7), new Biquad("highpass", 1000, 0.7)];
    this.hissLp = [new Biquad("lowpass", 8000, 0.7), new Biquad("lowpass", 8000, 0.7)];
  }

  next(out) {
    const s = this.strength.next();
    if (--this.gaps.far <= 0) {
      this.far.add(0.05 + 0.05 * Math.random() ** 2, rand(600, 3500), rand(0.7, 2.2),
        rand(0.0003, 0.002), rand(0.003, 0.008), rand(-1, 1), 0.55);
      this.gaps.far = nextGap(RAIN.far * s);
    }
    if (--this.gaps.mid <= 0) {
      this.near.add(0.06 + 0.12 * Math.random() ** 3, rand(900, 5000), rand(1, 5),
        rand(0.0002, 0.0012), rand(0.002, 0.008), rand(-0.9, 0.9), 0.32);
      this.gaps.mid = nextGap(RAIN.mid * s);
    }
    if (--this.gaps.near <= 0) {
      this.near.add(0.07 + 0.22 * Math.random() ** 4, rand(1200, 7000), rand(2, 7),
        rand(0.0001, 0.0006), rand(0.004, 0.012), rand(-0.8, 0.8), 0.18);
      this.gaps.near = nextGap(RAIN.near * s);
    }
    const f = this.farOut;
    f[0] = 0; f[1] = 0; f[2] = 0; f[3] = 0;
    this.far.mix(f);
    out[0] = this.farLp[0].next(f[0]);
    out[1] = this.farLp[1].next(f[1]);
    out[2] = f[2];
    out[3] = f[3];
    this.near.mix(out);
    for (let c = 0; c < 2; c++) {
      const h = this.hissLp[c].next(this.hissHp[c].next(white())) * RAIN.hiss;
      out[c] += h * 0.7;
      out[c + 2] += h * 0.3;
    }
  }
}

// ---------- Birds ----------

// Birds: 3 birds at different sides and distances (one far away), no other sound. Each has its own
// song: a phrase of a few syllables (fast pitch sweeps between about 2 and 7 kHz, whistles with a
// little vibrato, trills). A bird sings its phrase with small changes in pitch and timing each time
// and pauses several seconds between phrases. A far bird is quieter, duller and wetter.
const BIRD_PLACES = [{ dist: 0.2, pan: 0.5 }, { dist: 0.45, pan: -0.6 }, { dist: 0.9, pan: 0.1 }];

class Bird {
  constructor(place, trills) {
    this.dist = place.dist;
    [this.gl, this.gr] = panGains(place.pan);
    this.gain = 0.32 * (1 - 0.75 * this.dist);
    this.wet = 0.2 + 0.6 * this.dist;
    this.lp = new OnePole(9000 - 6000 * this.dist);
    this.trills = trills;
    this.song = this.makeSong();
    this.syllable = null;
    this.queue = [];
    this.wait = Math.round(rand(0.3, 3.5) * sampleRate); // the first phrase comes soon
    this.phase = 0;
  }

  // The bird's own song: 3–7 syllables around its own pitch.
  makeSong() {
    const centre = rand(2600, 5200);
    const count = 3 + Math.floor(Math.random() * 5);
    const song = [];
    for (let i = 0; i < count; i++) {
      const kind = this.trills && Math.random() < 0.3 ? "trill" : Math.random() < 0.5 ? "sweep" : "whistle";
      const f0 = centre * rand(0.75, 1.3);
      song.push({
        kind,
        f0,
        f1: kind === "sweep" ? f0 * rand(0.6, 1.6) : f0 * rand(0.95, 1.08),
        dur: kind === "trill" ? rand(0.18, 0.4) : rand(0.05, 0.18),
        gap: rand(0.03, 0.09),
        rate: rand(18, 32), // trill: notes per second
        depth: rand(0.08, 0.2),
        vib: rand(5, 9),
        amp: rand(0.6, 1),
      });
    }
    return song;
  }

  // The next phrase: the song with small changes, sometimes a syllable less or repeated.
  newPhrase() {
    const pitch = rand(0.96, 1.04);
    const tempo = rand(0.9, 1.1);
    let syllables = this.song.slice();
    if (syllables.length > 3 && Math.random() < 0.3) syllables = syllables.slice(0, -1);
    if (Math.random() < 0.25) {
      const k = Math.floor(Math.random() * syllables.length);
      syllables.splice(k, 0, syllables[k]);
    }
    this.queue = syllables.map((s) => ({
      ...s, f0: s.f0 * pitch * rand(0.98, 1.02), f1: s.f1 * pitch, dur: s.dur * tempo, gap: s.gap * tempo,
    }));
  }

  next(out) {
    if (!this.syllable) {
      if (--this.wait > 0) return;
      if (!this.queue.length) this.newPhrase();
      const s = this.queue.shift();
      const length = Math.max(1, Math.round(s.dur * sampleRate));
      // The sweep from f0 to f1: one multiplication per sample.
      this.syllable = { ...s, pos: 0, length, hz: s.f0, mul: Math.pow(s.f1 / s.f0, 1 / length) };
    }
    const s = this.syllable;
    const p = s.pos / s.length;
    const t = s.pos / sampleRate;
    let hz = s.hz;
    s.hz *= s.mul;
    if (s.kind === "trill") hz *= 1 + s.depth * fastSin(TWO_PI * s.rate * t);
    else if (s.kind === "whistle") hz *= 1 + 0.015 * fastSin(TWO_PI * s.vib * t);
    this.phase = (this.phase + (TWO_PI * hz) / sampleRate) % TWO_PI;
    // Soft start and end; a trill pulses with its notes.
    const arc = fastSin(Math.PI * p);
    let env = arc * Math.sqrt(arc);
    if (s.kind === "trill") env *= 0.55 + 0.45 * fastSin(TWO_PI * s.rate * t + 1);
    const x = (fastSin(this.phase) + 0.08 * fastSin(2 * this.phase)) * env * s.amp * this.gain;
    const y = this.lp.next(x);
    const dry = 1 - this.wet;
    out[0] += y * this.gl * dry;
    out[1] += y * this.gr * dry;
    out[2] += y * this.gl * this.wet;
    out[3] += y * this.gr * this.wet;
    if (++s.pos >= s.length) {
      this.syllable = null;
      // After the phrase's last syllable: a pause of several seconds.
      this.wait = this.queue.length ? Math.round(s.gap * sampleRate) : Math.round(rand(3, 12) * sampleRate);
    }
  }
}

class Birds {
  constructor() {
    this.birds = BIRD_PLACES.map((place) => new Bird(place, true));
  }

  next(out) {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    for (const bird of this.birds) bird.next(out);
    // A soft cap, so no syllable ever gets piercing.
    for (let i = 0; i < 4; i++) out[i] = softClip(out[i], 0.4);
  }
}

// ---------- Wind ----------

// Wind: noise through a slowly moving band-pass with a low Q (so it never whistles), its centre
// wandering between about 200 and 1200 Hz with the gusts. Gusts come one after another, each with its
// own length (5–15 s) and strength. At a gust's peak, a faint rustle of leaves: many tiny high bursts
// whose number rises with the gust.
class Wind {
  constructor() {
    this.pink = [new Pink(), new Pink()];
    this.band = [new Biquad("bandpass", 400, 0.8), new Biquad("bandpass", 400, 0.8)];
    this.colour = [new Drift(0.85, 1.15, 2, 6), new Drift(0.85, 1.15, 2, 6)];
    this.leaves = new Bursts(40);
    this.level = 0.25;
    this.newGust();
    this.count = 0;
    this.rustleGap = 1;
  }

  newGust() {
    this.start = this.level;
    this.peak = rand(0.55, 1);
    this.end = rand(0.15, 0.3);
    this.crest = rand(0.35, 0.6);
    this.length = Math.round(rand(5, 15) * sampleRate);
    this.pos = 0;
  }

  gust() {
    if (this.pos >= this.length) this.newGust();
    const p = this.pos++ / this.length;
    const [from, to, q] = p < this.crest
      ? [this.start, this.peak, p / this.crest]
      : [this.peak, this.end, (p - this.crest) / (1 - this.crest)];
    this.level = from + (to - from) * (0.5 - 0.5 * fastCos(Math.PI * q));
    return this.level;
  }

  next(out) {
    const g = this.gust();
    if ((this.count++ & 63) === 0) {
      for (let c = 0; c < 2; c++) this.band[c].set((220 + 900 * g * g) * this.colour[c].value, 0.8);
    }
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    for (let c = 0; c < 2; c++) {
      this.colour[c].next();
      const x = this.band[c].next(this.pink[c].next(white())) * 2.6 * g;
      out[c] = x * 0.85;
      out[c + 2] = x * 0.15;
    }
    if (--this.rustleGap <= 0) {
      const rate = 260 * g * g * g;
      if (g > 0.45) {
        this.leaves.add(0.008 + 0.02 * Math.random() ** 2, rand(3000, 8000), rand(0.8, 2),
          rand(0.0005, 0.002), rand(0.002, 0.006), rand(-1, 1), 0.35);
      }
      this.rustleGap = nextGap(Math.max(rate, 5));
    }
    this.leaves.mix(out);
  }
}

// ---------- Waves ----------

// Two kinds of wave, played together by WavesMix below:
//   the swell: brown and pink noise whose level and brightness follow a smooth swell.
//   the break: each wave has a shape: a short build, a fast break (a broadband rush with bright
//      foam), then a longer wash in which the foam fizzes and fades and gets duller. Between waves
//      only a soft, steady distant surf.

// The swell: brown and pink noise whose level follows one wave after another. Each wave has its own length
// (6–12 s), height, crest point and end level. It gets brighter at the crest (a low-pass opening up)
// with a little foam hiss, and drifts slowly between left and right.
class WavesSwell {
  constructor() {
    this.brown = [new Brown(), new Brown()];
    this.pink = [new Pink(), new Pink()];
    this.lp = [[new OnePole(400), new OnePole(400)], [new OnePole(400), new OnePole(400)]];
    this.foamHp = [new Biquad("highpass", 2500, 0.7), new Biquad("highpass", 2500, 0.7)];
    this.pan = new Drift(-0.35, 0.35, 8, 20);
    this.level = 0.4;
    this.newWave();
    this.count = 0;
  }

  newWave() {
    this.start = this.level;
    this.peak = rand(0.7, 1);
    this.end = rand(0.3, 0.45);
    this.crest = rand(0.4, 0.6);
    this.length = Math.round(rand(6, 12) * sampleRate);
    this.pos = 0;
  }

  // Worked out every 16 samples (step): it changes over seconds, so that's smooth enough.
  envelope(step) {
    if (this.pos >= this.length) this.newWave();
    const p = this.pos / this.length;
    this.pos += step;
    if (p < this.crest) {
      const q = p / this.crest;
      return this.start + (this.peak - this.start) * (0.5 - 0.5 * fastCos(Math.PI * q));
    }
    const q = (p - this.crest) / (1 - this.crest);
    return this.end + (this.peak - this.end) * Math.pow(1 - q, 2.2);
  }

  next(out) {
    const n = this.count++;
    if ((n & 15) === 0) {
      this.env = this.envelope(16);
      this.level = this.env;
    }
    const env = this.env;
    const pan = this.pan.next();
    if ((n & 63) === 0) {
      const hz = 450 + 1800 * env * env;
      for (const pair of this.lp) for (const f of pair) f.set(hz);
      [this.gl, this.gr] = panGains(pan);
    }
    const gl = this.gl;
    const gr = this.gr;
    for (let c = 0; c < 2; c++) {
      let x = this.brown[c].next(white()) * 0.8 + this.pink[c].next(white()) * 0.5;
      x = this.lp[c][1].next(this.lp[c][0].next(x));
      const foam = this.foamHp[c].next(white()) * 0.08 * env * env * env;
      const y = (x * 1.6 + foam) * env * (c === 0 ? gl : gr);
      out[c] = y * 0.88;
      out[c + 2] = y * 0.12;
    }
  }
}

// The break: build → break → wash → rest, every phase with its own random length; each wave at its
// own place between left and right.
class WavesBreak {
  constructor(gain = 1) {
    this.gain = gain;
    this.brown = [new Brown(), new Brown()];
    this.pink = [new Pink(), new Pink()];
    this.body = [new Biquad("lowpass", 500, 0.6), new Biquad("lowpass", 500, 0.6)];
    this.surfLp = [new Biquad("lowpass", 450, 0.6), new Biquad("lowpass", 450, 0.6)];
    this.foam = new Bursts(64);
    this.newWave();
    this.count = 0;
    this.foamGap = 1;
    this.env = 0;
  }

  newWave() {
    const sr = sampleRate;
    this.build = Math.round(rand(0.6, 1.6) * sr);
    this.breakLen = Math.round(rand(0.3, 0.6) * sr);
    this.wash = Math.round(rand(3, 6) * sr);
    this.rest = Math.round(rand(1, 4) * sr);
    this.height = rand(0.65, 1);
    [this.gl, this.gr] = panGains(rand(-0.4, 0.4));
    this.pos = 0;
  }

  // body: the rushing water; foam: how much fizz; bright: 0 (dull) … 1 (bright).
  // Worked out every 16 samples (step), like the swell's envelope.
  shape(step) {
    const p = this.pos;
    this.pos += step;
    const h = this.height;
    let body;
    let foam;
    let bright;
    if (p < this.build) {
      const q = p / this.build;
      body = 0.25 * h * q * q;
      foam = 0;
      bright = 0.2;
    } else if (p < this.build + this.breakLen) {
      const q = (p - this.build) / this.breakLen;
      body = h * (0.25 + 0.75 * Math.sin((Math.PI / 2) * q));
      foam = h * q;
      bright = 0.4 + 0.6 * q;
    } else if (p < this.build + this.breakLen + this.wash) {
      const q = (p - this.build - this.breakLen) / this.wash;
      body = h * Math.pow(1 - q, 2.4);
      foam = h * Math.pow(1 - q, 1.4);
      bright = 1 - 0.8 * q;
    } else {
      body = 0;
      foam = 0;
      bright = 0.2;
      if (p >= this.build + this.breakLen + this.wash + this.rest) this.newWave();
    }
    return [body, foam, bright];
  }

  next(out) {
    const n = this.count++;
    if ((n & 15) === 0) this.shaped = this.shape(16);
    const [body, foam, bright] = this.shaped;
    if ((n & 63) === 0) {
      for (let c = 0; c < 2; c++) this.body[c].set(350 + 3000 * bright * bright, 0.6);
    }
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    for (let c = 0; c < 2; c++) {
      const b = this.body[c].next(this.brown[c].next(white()) * 0.7 + this.pink[c].next(white()) * 0.6) * 1.6 * body;
      const surf = this.surfLp[c].next(this.brown[c].next(white())) * 1.0;
      const g = c === 0 ? this.gl : this.gr;
      out[c] = b * g * 0.85 + surf * 0.9;
      out[c + 2] = b * g * 0.15 + surf * 0.1;
    }
    if (--this.foamGap <= 0) {
      if (foam > 0.02) {
        const pan = (this.gr - this.gl) / 2 + rand(-0.5, 0.5);
        this.foam.add(0.01 + 0.03 * foam * Math.random(), rand(1500, 2500 + 5000 * bright), rand(0.7, 1.6),
          rand(0.0005, 0.002), rand(0.001, 0.004), Math.max(-1, Math.min(1, pan)), 0.25);
      }
      this.foamGap = nextGap(Math.max(5, 900 * foam));
    }
    this.foam.mix(out);
    out[0] *= this.gain; out[1] *= this.gain; out[2] *= this.gain; out[3] *= this.gain;
  }
}

// Waves: the two kinds of wave above, played at the same time, each with its own independent timing,
// so they overlap differently every time. Most of the time both play; sometimes only one (mostly the
// break and wash, rarely only the swell); never neither. A layer comes and goes over about 4 seconds
// (equal-power, so the sound never dips).
const WAVES_MIX = { both: 0.65, onlySwell: 0.07 };

class WavesMix {
  constructor() {
    this.p = WAVES_MIX;
    this.swell = new WavesSwell();
    this.breaker = new WavesBreak(0.93);
    this.fs = [0, 0, 0, 0];
    this.fb = [0, 0, 0, 0];
    this.presence = [1, 1]; // swell, break: 0 … 1
    this.target = [1, 1];
    this.left = Math.round(rand(20, 50) * sampleRate); // it starts with both
    this.step = 1 / (4 * sampleRate);
  }

  nextState() {
    const r = Math.random();
    if (r < this.p.both) {
      this.target = [1, 1];
      this.left = Math.round(rand(25, 70) * sampleRate);
    } else {
      this.target = r < this.p.both + this.p.onlySwell ? [1, 0] : [0, 1];
      this.left = Math.round(rand(15, 40) * sampleRate);
    }
  }

  next(out) {
    if (--this.left <= 0) this.nextState();
    for (let k = 0; k < 2; k++) {
      const d = this.target[k] - this.presence[k];
      if (d) this.presence[k] += Math.abs(d) < this.step ? d : Math.sign(d) * this.step;
    }
    this.swell.next(this.fs);
    this.breaker.next(this.fb);
    const gs = Math.sqrt(this.presence[0]) * 0.8;
    const gb = Math.sqrt(this.presence[1]) * 0.8;
    for (let i = 0; i < 4; i++) out[i] = this.fs[i] * gs + this.fb[i] * gb;
  }
}

// ---------- Crickets ----------

// Crickets: 3–5 crickets at different distances and sides, no other sound. Each has its own pitch
// (about 4–5 kHz), its own chirp (a train of 2–5 short pulses) and its own pace, slightly irregular,
// so they never chirp in step. Far ones are quieter, duller and wetter. A soft cap keeps them in the
// background, like Birds.
class Cricket {
  constructor(dist, pan) {
    [this.gl, this.gr] = panGains(pan);
    this.gain = 0.22 * (1 - 0.7 * dist);
    this.wet = 0.15 + 0.5 * dist;
    this.lp = new OnePole(9500 - 5000 * dist);
    this.hz = rand(4000, 5000);
    this.pulses = 2 + Math.floor(Math.random() * 4);
    this.pulseLen = Math.round(rand(0.008, 0.016) * sampleRate);
    this.pulseGap = Math.round(rand(0.008, 0.014) * sampleRate);
    this.period = rand(0.35, 1.1);
    this.am = rand(180, 320); // the buzz of the wings
    // A cricket that chirps more of the time is a little quieter, so 3 or 5 crickets with any paces
    // add up to about the same loudness.
    const duty = (this.pulses * this.pulseLen) / (this.period * sampleRate);
    this.gain *= Math.min(1.6, Math.max(0.6, Math.sqrt(0.08 / duty)));
    this.phase = 0;
    this.amPhase = 0;
    this.wait = Math.round(rand(0, this.period) * sampleRate);
    this.left = 0; // pulses left in this chirp
    this.pos = -1; // position in the pulse, -1 between pulses
  }

  next(out) {
    if (this.pos < 0) {
      if (--this.wait > 0) return;
      if (this.left <= 0) {
        // A new chirp, now and then with a pulse more or less.
        this.left = Math.max(1, this.pulses + (Math.random() < 0.15 ? (Math.random() < 0.5 ? -1 : 1) : 0));
        this.chirpHz = this.hz * rand(0.99, 1.01);
      }
      this.pos = 0;
    }
    const p = this.pos / this.pulseLen;
    const arc = fastSin(Math.PI * p);
    const env = arc * arc;
    this.phase = (this.phase + (TWO_PI * this.chirpHz) / sampleRate) % TWO_PI;
    this.amPhase = (this.amPhase + (TWO_PI * this.am) / sampleRate) % TWO_PI;
    const x = fastSin(this.phase) * env * (0.75 + 0.25 * fastSin(this.amPhase)) * this.gain;
    const y = this.lp.next(x);
    out[0] += y * this.gl * (1 - this.wet);
    out[1] += y * this.gr * (1 - this.wet);
    out[2] += y * this.gl * this.wet;
    out[3] += y * this.gr * this.wet;
    if (++this.pos >= this.pulseLen) {
      this.pos = -1;
      this.left--;
      const chirpLen = this.pulses * (this.pulseLen + this.pulseGap);
      this.wait = this.left > 0
        ? this.pulseGap
        : Math.max(this.pulseGap, Math.round(this.period * rand(0.92, 1.08) * sampleRate) - chirpLen);
    }
  }
}

class Crickets {
  constructor() {
    const places = [[0.2, -0.5], [0.45, 0.6], [0.7, -0.15], [0.85, 0.35], [0.95, -0.75]];
    const n = 3 + Math.floor(Math.random() * 3);
    this.crickets = places.slice(0, n).map(([dist, pan]) => new Cricket(dist, pan));
    this.scale = Math.sqrt(4 / n); // as loud with 3 crickets as with 5
  }

  next(out) {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    for (const cricket of this.crickets) cricket.next(out);
    for (let i = 0; i < 4; i++) out[i] = softClip(out[i] * this.scale, 0.4);
  }
}

// ---------- Fan, Vacuum ----------

// Fan: airy noise (pink and a little brown, low-passed, as from a fan or an air conditioner) with a
// soft motor hum at 100 Hz and its first harmonic, and a barely noticeable slow drift.
class Fan {
  constructor() {
    this.pink = [new Pink(), new Pink()];
    this.brown = [new Brown(), new Brown()];
    this.lp = [new Biquad("lowpass", 1400, 0.55), new Biquad("lowpass", 1400, 0.55)];
    this.drift = new Drift(0.92, 1, 3, 9);
    this.phase = 0;
    this.inc = (TWO_PI * 100) / sampleRate;
  }

  next(out) {
    const d = this.drift.next();
    this.phase = (this.phase + this.inc) % TWO_PI;
    const hum = (fastSin(this.phase) * 0.05 + fastSin(2 * this.phase) * 0.02) * d;
    for (let c = 0; c < 2; c++) {
      const air = this.lp[c].next(this.pink[c].next(white()) + this.brown[c].next(white()) * 0.35);
      const y = air * 1.3 * d + hum;
      out[c] = y * 0.95;
      out[c + 2] = y * 0.05;
    }
  }
}

// Vacuum: a motor's whirr. Band-passed air noise, plus a motor tone (about 140 Hz with harmonics
// that get quieter) whose speed wobbles slightly and irregularly, and a soft high whine.
class Vacuum {
  constructor() {
    this.pink = [new Pink(), new Pink()];
    this.air = [new Biquad("bandpass", 1100, 0.6), new Biquad("bandpass", 1100, 0.6)];
    this.body = [new Biquad("lowpass", 500, 0.7), new Biquad("lowpass", 500, 0.7)];
    this.wobble = new Drift(-1, 1, 0.4, 1.6);
    this.phase = 0;
    this.whinePhase = 0;
    this.harmonics = [1, 0.5, 0.33, 0.22, 0.14, 0.09].map((a) => a * 0.1);
  }

  next(out) {
    const speed = 1 + 0.006 * this.wobble.next();
    this.phase = (this.phase + (TWO_PI * 140 * speed) / sampleRate) % TWO_PI;
    this.whinePhase = (this.whinePhase + (TWO_PI * 1180 * speed) / sampleRate) % TWO_PI;
    let motor = 0;
    // The harmonics from one sine and cosine: sin((k+1)x) = 2 cos(x) sin(kx) − sin((k−1)x).
    const c2 = 2 * fastCos(this.phase);
    let prev = 0;
    let cur = fastSin(this.phase);
    for (let k = 0; k < this.harmonics.length; k++) {
      motor += cur * this.harmonics[k];
      const next = c2 * cur - prev;
      prev = cur;
      cur = next;
    }
    motor += fastSin(this.whinePhase) * 0.012;
    for (let c = 0; c < 2; c++) {
      const p = this.pink[c].next(white());
      const y = this.air[c].next(white()) * 0.55 + this.body[c].next(p) * 0.9 + motor;
      out[c] = y * 0.94;
      out[c + 2] = y * 0.06;
    }
  }
}

// The sounds, by the id focus-sound.js uses.
const SOUNDS = {
  rain: () => new Rain(),
  birds: () => new Birds(),
  wind: () => new Wind(),
  waves: () => new WavesMix(),
  crickets: () => new Crickets(),
  fan: () => new Fan(),
  vacuum: () => new Vacuum(),
};

// One node plays one sound (processorOptions.type). Two stereo outputs:
// 0 is dry, 1 goes to the reverb. A "stopAt" message (an audio clock time, sent with the fade-out)
// ends it once the fade is over: it then tells the page ("ended") and stops running, so nothing keeps
// working in silence.
class FocusAmbientProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions || {};
    const make = SOUNDS[opts.type] || SOUNDS.fan;
    this.sound = make();
    this.stopAt = Infinity;
    this.frame = [0, 0, 0, 0];
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.stopAt === "number") this.stopAt = event.data.stopAt;
    };
  }

  process(inputs, outputs) {
    if (currentTime >= this.stopAt) {
      // Said once: a node with an input (the limiter) can still be called after it has ended.
      if (!this.ended) this.port.postMessage("ended");
      this.ended = true;
      return false;
    }
    const dry = outputs[0];
    const wet = outputs[1];
    const frame = this.frame;
    const n = dry[0].length;
    for (let i = 0; i < n; i++) {
      this.sound.next(frame);
      dry[0][i] = frame[0];
      dry[1][i] = frame[1];
      if (wet) {
        wet[0][i] = frame[2];
        wet[1][i] = frame[3];
      }
    }
    return true;
  }
}

registerProcessor("focus-ambient", FocusAmbientProcessor);

// The limiter on the whole mix (focus-sound.js puts it after the master volume). It looks 3 ms ahead:
// for every sample it knows the loudest peak about to come and turns the volume down just enough,
// just in time, so the output never goes over CEILING (about −3 dBFS). Below that it changes nothing
// at all, so at normal settings it can't be heard; with many loud layers it only shaves the peaks.
// Releases over about 120 ms. Stops like the sounds ("stopAt").
const LIMITER_CEILING = 0.7;
const LIMITER_LOOKAHEAD_S = 0.003;

class FocusLimiterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.look = Math.max(1, Math.round(LIMITER_LOOKAHEAD_S * sampleRate));
    this.delay = [new Float32Array(this.look), new Float32Array(this.look)];
    this.pos = 0;
    // The smallest gain needed over the next `look` samples: a queue of (sample number, gain) that
    // only keeps gains smaller than everything after them, so the front is always the minimum.
    const size = this.look + 2;
    this.qGain = new Float64Array(size);
    this.qAt = new Float64Array(size);
    this.qHead = 0;
    this.qTail = 0;
    this.size = size;
    this.n = 0;
    this.gain = 1;
    this.attack = 1 - Math.exp(-1 / (0.0008 * sampleRate));
    this.release = 1 - Math.exp(-1 / (0.12 * sampleRate));
    this.stopAt = Infinity;
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.stopAt === "number") this.stopAt = event.data.stopAt;
    };
  }

  process(inputs, outputs) {
    if (currentTime >= this.stopAt) {
      // Said once: a node with an input (the limiter) can still be called after it has ended.
      if (!this.ended) this.port.postMessage("ended");
      this.ended = true;
      return false;
    }
    const input = inputs[0];
    const output = outputs[0];
    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const frames = outL.length;
    const { size, look } = this;
    for (let i = 0; i < frames; i++) {
      const l = inL ? inL[i] : 0;
      const r = inR ? inR[i] : 0;
      const peak = Math.max(Math.abs(l), Math.abs(r));
      const needed = peak > LIMITER_CEILING ? LIMITER_CEILING / peak : 1;
      const n = this.n++;
      while (this.qTail > this.qHead && this.qGain[(this.qTail - 1) % size] >= needed) this.qTail--;
      this.qGain[this.qTail % size] = needed;
      this.qAt[this.qTail % size] = n;
      this.qTail++;
      while (this.qAt[this.qHead % size] <= n - look) this.qHead++;
      const target = this.qGain[this.qHead % size];
      this.gain += (target - this.gain) * (target < this.gain ? this.attack : this.release);
      const dl = this.delay[0][this.pos];
      const dr = this.delay[1][this.pos];
      this.delay[0][this.pos] = l;
      this.delay[1][this.pos] = r;
      this.pos = (this.pos + 1) % look;
      // A last guard for the tiny overshoot while the gain is still catching up.
      outL[i] = Math.max(-0.98, Math.min(0.98, dl * this.gain));
      outR[i] = Math.max(-0.98, Math.min(0.98, dr * this.gain));
    }
    return true;
  }
}

registerProcessor("focus-limiter", FocusLimiterProcessor);
