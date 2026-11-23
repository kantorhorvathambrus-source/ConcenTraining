// The Ambient focus sounds (Rain, Thunder, Birds, Wind, Fire, Waves, Stream, Crickets, Fan, Vacuum,
// Train, Airplane), generated live, sample by sample, and the limiter that keeps the whole mix from clipping. This is an AudioWorklet module: it
// runs on the browser's audio thread, not on the page, and is loaded by focus-sound.js
// (audioWorklet.addModule). See "Focus sound" in the README.
//
// Why live and not a loop: every drop, crackle, bird phrase and wave is rolled from random numbers as
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
// process: as irregular as real drops or crackles, never a rhythm), in samples.
function nextGap(perSecond) {
  return Math.max(1, Math.round((-Math.log(1 - Math.random()) / Math.max(perSecond, 1e-6)) * sampleRate));
}

// Short resonant bursts: drops, crackles, pops, leaf rustle. Each burst is a little noise with its
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

// Struck resonances: wood snaps, wheel and rail ringing, thumps. Each one starts at full amplitude on
// its first sample (an instant onset, the "snap" a struck object has) and rings at its own frequency,
// dying away exponentially (decay = time to fall to 1/e). Two multiplications per sample: the
// recurrence y[n] = 2r·cos(w)·y[n−1] − r²·y[n−2] is a damped cosine. A fixed pool, like Bursts.
class Rings {
  constructor(size) {
    this.size = size;
    this.count = 0;
    this.y1 = new Float64Array(size);
    this.y2 = new Float64Array(size);
    this.c1 = new Float64Array(size);
    this.c2 = new Float64Array(size);
    this.gl = new Float64Array(size);
    this.gr = new Float64Array(size);
    this.wet = new Float64Array(size);
    this.left = new Int32Array(size);
  }

  add(amp, hz, decayS, pan, wet) {
    if (this.count >= this.size) return;
    const i = this.count++;
    const w = (TWO_PI * Math.min(hz, sampleRate * 0.45)) / sampleRate;
    const r = Math.exp(-1 / (decayS * sampleRate));
    this.c1[i] = 2 * r * Math.cos(w);
    this.c2[i] = r * r;
    // y[n] = amp·rⁿ·cos(wn): full amplitude on the first sample. y2 is y[−1], so the recurrence
    // carries on from there.
    this.y1[i] = amp;
    this.y2[i] = (amp * Math.cos(w)) / r;
    const [gl, gr] = panGains(pan);
    this.gl[i] = gl;
    this.gr[i] = gr;
    this.wet[i] = wet;
    this.left[i] = Math.ceil(6.9 * decayS * sampleRate); // until 60 dB down
  }

  // Adds every active ring's next sample to out (dry L, dry R, wet L, wet R).
  mix(out) {
    let i = 0;
    while (i < this.count) {
      const y = this.y1[i];
      const w = this.wet[i];
      out[0] += y * this.gl[i] * (1 - w);
      out[1] += y * this.gr[i] * (1 - w);
      out[2] += y * this.gl[i] * w;
      out[3] += y * this.gr[i] * w;
      const next = this.c1[i] * y - this.c2[i] * this.y2[i];
      this.y2[i] = y;
      this.y1[i] = next;
      if (--this.left[i] <= 0) {
        const last = --this.count;
        this.y1[i] = this.y1[last]; this.y2[i] = this.y2[last]; this.c1[i] = this.c1[last]; this.c2[i] = this.c2[last];
        this.gl[i] = this.gl[last]; this.gr[i] = this.gr[last]; this.wet[i] = this.wet[last]; this.left[i] = this.left[last];
      } else {
        i++;
      }
    }
  }
}

// The "harmonic shadow" of a deep sound: phone speakers play almost nothing under about 200 Hz, so a
// deep thump or rumble would vanish there. Half-wave rectifying it (max(x, 0)) makes harmonics of
// it, and band-passing those to the range a speaker can play (lo–hi) gives a part that follows the
// deep sound exactly; mixed in, the ear hears the missing low end (the "missing fundamental", the
// trick psychoacoustic bass enhancement uses). On headphones the real low band is there as well.
class Shadow {
  constructor(lo, hi) {
    this.hp = new Biquad("highpass", lo, 0.7);
    this.lp = new Biquad("lowpass", hi, 0.7);
  }

  next(x) {
    return this.lp.next(this.hp.next(x > 0 ? x : 0));
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

// ---------- Fire ----------

// Fire, after Andy Farnell's three-part model (Designing Sound), plus the sharp snap synthetic fires
// usually lack:
// - Lapping, the flame itself: white noise through a narrow band-pass at about 30 Hz, driven hard
//   into a clip and high-passed. The clipping turns the slow random low noise into a fluttering,
//   burbling flame with harmonics up into the hundreds of Hz (which a phone speaker can play). No
//   added amplitude modulation: that's what made the earlier version chuff like a steam engine.
// - Hissing: soft, continuous noise from about 1 to 7.5 kHz whose level follows a slow random
//   signal raised to the 4th power: mostly quiet, with rare louder moments (gas escaping). Never in
//   runs.
// - Crackling: sparse random events with heavy-tailed loudness (most small, a few big). Each has an
//   instant onset (the snap), a short broadband click, then 1–3 resonances around Farnell's crackle
//   frequencies (about 600, 1000, 1200 and 2600 Hz, ±30%) ringing 1–25 ms (mostly short).
//   Occasionally a quick cluster, like wood catching.
// - Pops, rare: a sharp click and a short low thump (150–400 Hz) with its harmonic shadow.
// Each ear has its own generators, and every event its own place. Variants for the listening lab:
//   a: a fireplace: fuller lapping, 1–4 crackles a second, a few pops a minute, a small room.
//   b: a campfire: softer, more open lapping, denser crackles (many tiny), little reverb.
const FIRE_VARIANTS = {
  a: { lap: 0.5, drive: 180, lapQ: 1, hiss: 0.3, crackle: 2.5, crackleAmp: 1.8, clusters: 0.12, tiny: 0.25, pop: 0.06, wet: 0.3, gain: 1 },
  b: { lap: 0.36, drive: 120, lapQ: 1, hiss: 0.3, crackle: 8, crackleAmp: 1.5, clusters: 0.2, tiny: 0.65, pop: 0.04, wet: 0.1, gain: 1.05 },
};
const CRACKLE_HZ = [600, 1000, 1200, 2600];

class Fire {
  constructor(variant) {
    this.v = FIRE_VARIANTS[variant] || FIRE_VARIANTS.a;
    this.lapBand = [new Biquad("bandpass", 30, this.v.lapQ), new Biquad("bandpass", 30, this.v.lapQ)];
    this.lapHp = [new Biquad("highpass", 25, 0.7), new Biquad("highpass", 25, 0.7)];
    this.gasLp = [new OnePole(1), new OnePole(1)];
    this.hissHp = [new Biquad("highpass", 1000, 0.7), new Biquad("highpass", 1000, 0.7)];
    this.hissLp = [new OnePole(7500), new OnePole(7500)];
    this.clicks = new Bursts(32);
    this.rings = new Rings(96);
    this.thumps = new Rings(8);
    this.shadow = [new Shadow(150, 600), new Shadow(150, 600)];
    this.crackleGap = nextGap(this.v.crackle);
    this.clusterGap = nextGap(this.v.clusters);
    this.clusterLeft = 0;
    this.clusterNext = 0;
    this.popGap = nextGap(this.v.pop);
    this.events = [0, 0, 0, 0];
    this.low = [0, 0, 0, 0];
    this.shadowLeft = 0; // the pop shadow only runs while a pop rings (and a moment after)
  }

  crackle(scale) {
    const v = this.v;
    const amp = (Math.random() < v.tiny ? 0.12 : 1) * (0.04 + 0.96 * Math.random() ** 3) * scale * v.crackleAmp;
    const pan = rand(-0.85, 0.85);
    this.clicks.add(amp * 0.5, rand(3000, 7000), 0.7, 0.00002, rand(0.0001, 0.0003), pan, v.wet);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const hz = CRACKLE_HZ[Math.floor(Math.random() * 4)] * rand(0.7, 1.3);
      const decay = 0.001 * Math.pow(25, Math.random() ** 2.5); // 1–25 ms, mostly short
      this.rings.add(amp * rand(0.4, 1), hz, decay, pan, v.wet);
    }
  }

  pop() {
    const v = this.v;
    const amp = 0.5 + 0.5 * Math.random();
    const pan = rand(-0.6, 0.6);
    this.clicks.add(amp * 0.8, rand(3000, 6000), 0.8, 0.00002, 0.0003, pan, v.wet);
    this.thumps.add(amp, rand(150, 400), rand(0.015, 0.04), pan, v.wet);
    this.shadowLeft = Math.round(0.4 * sampleRate);
  }

  next(out) {
    const v = this.v;
    if (--this.crackleGap <= 0) {
      this.crackle(1);
      this.crackleGap = nextGap(v.crackle);
    }
    if (--this.clusterGap <= 0) {
      this.clusterLeft = 3 + Math.floor(Math.random() * 8); // a quick run of 3–10
      this.clusterNext = 1;
      this.clusterGap = nextGap(v.clusters);
    }
    if (this.clusterLeft > 0 && --this.clusterNext <= 0) {
      this.crackle(0.7);
      this.clusterLeft--;
      this.clusterNext = nextGap(rand(25, 60));
    }
    if (--this.popGap <= 0) {
      this.pop();
      this.popGap = nextGap(v.pop);
    }
    const e = this.events;
    e[0] = 0; e[1] = 0; e[2] = 0; e[3] = 0;
    this.clicks.mix(e);
    this.rings.mix(e);
    const lo = this.low;
    lo[0] = 0; lo[1] = 0; lo[2] = 0; lo[3] = 0;
    this.thumps.mix(lo);
    let shadowing = false;
    if (this.shadowLeft > 0) {
      shadowing = true;
      if (--this.shadowLeft === 0) {
        // Quiet again: start the next pop's shadow from rest.
        for (const sh of this.shadow) for (const f of [sh.hp, sh.lp]) { f.x1 = 0; f.x2 = 0; f.y1 = 0; f.y2 = 0; }
      }
    }
    for (let c = 0; c < 2; c++) {
      const raw = this.lapBand[c].next(white()) * v.drive;
      const lap = this.lapHp[c].next(raw > 0.9 ? 0.9 : raw < -0.9 ? -0.9 : raw) * 0.5 * v.lap;
      const g = this.gasLp[c].next(white()) * 200;
      const gas = Math.min(2.5, 0.25 + 0.35 * g * g * g * g);
      const hiss = this.hissLp[c].next(this.hissHp[c].next(white())) * v.hiss * 0.25 * gas;
      const thump = shadowing ? lo[c] + this.shadow[c].next(lo[c]) * 1.5 : 0;
      const bed = lap + hiss;
      // Crackles and pops share one soft limit, so even the biggest stays well under full scale.
      out[c] = (bed * (1 - v.wet) + softClip(e[c] + thump, 0.6)) * v.gain;
      out[c + 2] = (bed * v.wet + softClip(e[c + 2] + lo[c + 2], 0.6)) * v.gain;
    }
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

// ---------- Stream ----------

// Stream: a brook. Many small bubbles (the sound of an air bubble in water: a short sine whose pitch
// rises a little as it dies away, about 300–2000 Hz; a small bubble rings higher and shorter) over a
// gentle broadband babble that ripples fast (tens to hundreds of ms). Lively but steady: no slow swell.
class Stream {
  constructor() {
    this.pink = [new Pink(), new Pink()];
    this.babbleHp = [new Biquad("highpass", 300, 0.7), new Biquad("highpass", 300, 0.7)];
    this.babbleLp = [new Biquad("lowpass", 3000, 0.7), new Biquad("lowpass", 3000, 0.7)];
    this.ripple = [new Drift(0.7, 1, 0.03, 0.15), new Drift(0.7, 1, 0.03, 0.15)];
    this.busy = new Drift(0.85, 1.15, 0.4, 1.5);
    const n = 48;
    this.size = n;
    this.count = 0;
    this.phase = new Float64Array(n);
    this.inc = new Float64Array(n);
    this.chirp = new Float64Array(n);
    this.env = new Float64Array(n);
    this.decay = new Float64Array(n);
    this.amp = new Float64Array(n);
    this.gl = new Float64Array(n);
    this.gr = new Float64Array(n);
    this.wet = new Float64Array(n);
    this.gap = nextGap(220);
  }

  bubble() {
    if (this.count >= this.size) return;
    const i = this.count++;
    const hz = 300 * Math.pow(2000 / 300, Math.random() ** 1.3);
    const tau = rand(8, 22) / hz; // rings for 8–22 cycles
    const rise = rand(0.1, 0.4); // the pitch rises 10–40% over its life
    this.phase[i] = 0;
    this.inc[i] = (TWO_PI * hz) / sampleRate;
    this.chirp[i] = Math.pow(1 + rise, 1 / (3 * tau * sampleRate));
    this.env[i] = 1;
    this.decay[i] = Math.exp(-1 / (tau * sampleRate));
    this.amp[i] = 0.03 + 0.14 * Math.random() ** 3;
    const [gl, gr] = panGains(rand(-0.9, 0.9));
    this.gl[i] = gl;
    this.gr[i] = gr;
    this.wet[i] = rand(0.15, 0.4);
  }

  next(out) {
    if (--this.gap <= 0) {
      this.bubble();
      this.gap = nextGap(220 * this.busy.next());
    }
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    let i = 0;
    while (i < this.count) {
      this.phase[i] += this.inc[i];
      this.inc[i] *= this.chirp[i];
      const s = fastSin(this.phase[i]) * this.env[i] * this.amp[i];
      this.env[i] *= this.decay[i];
      const w = this.wet[i];
      out[0] += s * this.gl[i] * (1 - w);
      out[1] += s * this.gr[i] * (1 - w);
      out[2] += s * this.gl[i] * w;
      out[3] += s * this.gr[i] * w;
      if (this.env[i] < 0.01) {
        // Finished (40 dB down, lost in the babble): the last bubble takes its place.
        const last = --this.count;
        this.phase[i] = this.phase[last]; this.inc[i] = this.inc[last]; this.chirp[i] = this.chirp[last];
        this.env[i] = this.env[last]; this.decay[i] = this.decay[last]; this.amp[i] = this.amp[last];
        this.gl[i] = this.gl[last]; this.gr[i] = this.gr[last]; this.wet[i] = this.wet[last];
      } else {
        i++;
      }
    }
    for (let c = 0; c < 2; c++) {
      const b = this.babbleLp[c].next(this.babbleHp[c].next(this.pink[c].next(white()))) * 0.39 * this.ripple[c].next();
      out[c] += b * 0.8;
      out[c + 2] += b * 0.2;
    }
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

// ---------- Thunder ----------

// Thunder: distant only, after the Fineberg, Walters and Reiss model (built on Andy Farnell's thunder;
// the synthetic thunder rated most realistic in their listening test). One event at random every
// 20–90 s (the first within 3–10 s), each 8–14 s plus its echoes, made of:
// - The rumbler, the main body: white noise through a low-pass whose cutoff glides from about
//   800–1000 Hz down towards 50 Hz, half-wave rectified (which also gives it harmonics a phone speaker
//   can play), its level jumping in irregular steps (sample and hold: a new random level at a random
//   rate, fast at first and slower later). That stepping is the rolling: the opposite of a smooth
//   swell. Overall a rise of 0.3–1 s, then an irregular decay made of 3–8 overlapping sub-rolls.
// - The growl: very low noise, driven into a clip and low-passed, under the whole event, with its
//   harmonic shadow at 120–400 Hz so it's heard on a phone too.
// - The afterimage: a soft, ringing band at about 333 Hz from clipped noise times noise.
// - In variant b only, at the start of about half the events: 1–3 soft, distant claps (noise in a
//   narrow band gliding down, softened by the distance). Never sharp.
// - Environment: an echo (0.4–0.9 s, fading in 1–3 repeats, duller each time), its own place per
//   event, and more of the shared reverb than other sounds.
// The whole is soft-capped, so it never startles. Variants for the listening lab:
//   a: rolling rumble and growl only, no clap.
//   b: soft distant claps at the start of about half the events, a little closer (brighter, drier).
const THUNDER_VARIANTS = {
  a: { claps: 0, from: [800, 1000], wet: 0.45, gain: 1 },
  b: { claps: 0.5, from: [950, 1200], wet: 0.35, gain: 0.68 },
};

class Thunder {
  constructor(variant) {
    this.v = THUNDER_VARIANTS[variant] || THUNDER_VARIANTS.a;
    this.rumbleLp = [new Biquad("lowpass", 900, 0.7), new Biquad("lowpass", 900, 0.7)];
    this.rumbleHp = [new Biquad("highpass", 30, 0.7), new Biquad("highpass", 30, 0.7)];
    this.growlLp = [new Biquad("lowpass", 60, 0.7), new Biquad("lowpass", 60, 0.7)];
    this.growlHp = [new Biquad("highpass", 30, 0.7), new Biquad("highpass", 30, 0.7)];
    this.growlLp2 = [new OnePole(80), new OnePole(80)];
    this.growlShadow = [new Shadow(120, 400), new Shadow(120, 400)];
    this.afterLp = [new OnePole(100), new OnePole(100)];
    this.afterBand = [new Biquad("bandpass", 333, 4), new Biquad("bandpass", 333, 4)];
    this.clapBand = [new Biquad("bandpass", 800, 7), new Biquad("bandpass", 800, 7)];
    this.clapLp = [new Biquad("lowpass", 1500, 0.7), new Biquad("lowpass", 1500, 0.7)];
    this.echo = [new Float32Array(sampleRate), new Float32Array(sampleRate)];
    this.echoLp = [new OnePole(1200), new OnePole(1200)];
    this.echoPos = 0;
    this.event = null;
    this.wait = Math.round(rand(3, 10) * sampleRate);
    this.count = 0;
    this.env = 0;
    this.slow = 0;
    this.hold = [0, 0];
    this.holdLeft = [0, 0];
    this.clapEnv = 0;
  }

  newEvent() {
    const v = this.v;
    const length = rand(8, 14);
    const rolls = [{ at: 0, amp: 1, decay: rand(1.2, 2.5) }];
    for (let k = 2 + Math.floor(Math.random() * 6); k > 0; k--) {
      rolls.push({ at: rand(0.3, length * 0.6), amp: 0.25 + 0.75 * Math.random() ** 1.5, decay: rand(0.8, 2.5) });
    }
    const claps = [];
    if (Math.random() < v.claps) {
      let at = rand(0, 0.15);
      for (let k = 1 + Math.floor(Math.random() * 3); k > 0; k--) {
        claps.push({ at, len: rand(0.02, 0.3), from: Math.random() * 1200 + 100, amp: rand(0.4, 1) });
        at += rand(0.05, 0.25);
      }
    }
    const [gl, gr] = panGains(rand(-0.6, 0.6));
    this.event = {
      t: 0, length, rise: rand(0.3, 1), from: rand(v.from[0], v.from[1]), rolls, claps, gl, gr,
      level: rand(0.7, 1), delay: Math.round(rand(0.4, 0.9) * sampleRate),
    };
  }

  // The event's envelope at time t: the rise, then the sub-rolls (each a quick rise and a decay).
  envelope(e) {
    const t = e.t;
    const r = Math.min(1, t / e.rise);
    let sum = 0;
    for (const roll of e.rolls) {
      const d = t - roll.at;
      if (d > 0) sum += roll.amp * (1 - Math.exp(-d / 0.15)) * Math.exp(-d / roll.decay);
    }
    return r * r * (3 - 2 * r) * sum * e.level;
  }

  next(out) {
    const v = this.v;
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    const e = this.event;
    let dl = 0;
    let dr = 0;
    if (!e) {
      if (--this.wait <= 0) this.newEvent();
    } else {
      const t = e.t;
      e.t += 1 / sampleRate;
      if ((this.count++ & 31) === 0) {
        this.env = Math.min(1.5, this.envelope(e));
        this.slow = Math.exp(-t / (e.length * 0.45)) * Math.min(1, t / e.rise) * e.level;
        const cutoff = e.from * Math.pow(50 / e.from, Math.min(1, t / e.length));
        for (let c = 0; c < 2; c++) this.rumbleLp[c].set(cutoff, 0.7);
        // The claps: their band glides down to half, a soft 15 ms start, then dying away.
        this.clapEnv = 0;
        for (const clap of e.claps) {
          const q = (t - clap.at) / clap.len;
          if (q > 0 && q < 1) {
            this.clapEnv += clap.amp * Math.min(1, (t - clap.at) / 0.015) * (1 - q) * (1 - q);
            for (let c = 0; c < 2; c++) this.clapBand[c].set(clap.from * (1 - 0.5 * q), 7);
          }
        }
      }
      const done = t > e.length;
      for (let c = 0; c < 2; c++) {
        if (--this.holdLeft[c] <= 0) {
          // Fast steps at first (about 50 ms), slower later (up to about half a second); most steps
          // are small, a few are big.
          this.hold[c] = 0.05 + 0.95 * Math.random() ** 2;
          this.holdLeft[c] = Math.round((0.05 + 0.35 * Math.min(1, t / e.length)) * rand(0.5, 1.5) * sampleRate);
        }
        let x = 0;
        if (!done) {
          const lp = this.rumbleLp[c].next(white());
          const rumble = this.rumbleHp[c].next(lp > 0 ? lp : 0) * 9 * this.env * this.hold[c];
          let g = this.growlHp[c].next(this.growlLp[c].next(white())) * 40;
          g = g > 1 ? 1 : g < -1 ? -1 : g;
          const growl = this.growlLp2[c].next(g) * this.slow;
          const shadow = this.growlShadow[c].next(growl) * 1.6;
          let a = this.afterLp[c].next(white()) * 80 * white();
          a = a > 1 ? 1 : a < -1 ? -1 : a;
          const after = this.afterBand[c].next(a) * 0.4 * this.slow;
          const clap = this.clapEnv ? this.clapLp[c].next(this.clapBand[c].next(white())) * 3 * this.clapEnv : 0;
          x = rumble + growl * 0.5 + shadow + after + clap;
        }
        // The echo: what went in 0.4–0.9 s ago comes back quieter and duller, and again (feedback).
        const buf = this.echo[c];
        const read = (this.echoPos - e.delay + sampleRate) % sampleRate;
        const back = buf[read];
        buf[this.echoPos] = this.echoLp[c].next(x + back * 0.15);
        const y = (x + back * 0.4) * (c === 0 ? e.gl : e.gr);
        if (c === 0) dl = y;
        else dr = y;
      }
      this.echoPos = (this.echoPos + 1) % sampleRate;
      if (t > e.length + 3) {
        this.event = null;
        this.echo[0].fill(0);
        this.echo[1].fill(0);
        this.wait = Math.round(rand(20, 90) * sampleRate);
      }
    }
    // A soft cap: even the strongest roll stays well under full scale.
    const l = softClip(dl, 1 / 1.2);
    const r = softClip(dr, 1 / 1.2);
    out[0] = l * (1 - v.wet) * v.gain;
    out[1] = r * (1 - v.wet) * v.gain;
    out[2] = l * v.wet * v.gain;
    out[3] = r * v.wet * v.gain;
  }
}

// ---------- Train ----------

// Train: inside a carriage on jointed track.
// - The rhythm comes from the geometry: at each rail joint the bogie under you gives two hits,
//   "da-dum" (its two axles, 2.5 m apart: about 0.1–0.13 s at 70–90 km/h), and the carriage's other
//   bogie a quieter pair half a cycle later. One cycle per rail (25 m): 1.0–1.3 s at that speed. The
//   speed drifts slowly (±10% over minutes) and every interval follows it, so the whole tempo changes
//   together. Each hit has a little timing jitter (±2%) and its own loudness.
// - Each hit: an instant onset, a low thump (50–150 Hz) with its harmonic shadow, a metallic part
//   (2–4 short inharmonic resonances at 600–3000 Hz: wheel and rail ringing) and a few tiny rattling
//   ticks right after.
// - Rolling noise: steady and broadband (most energy at 80–1000 Hz), with a very slight flutter at the
//   wheels' rotation rate (about 7–9 Hz, ±1 dB), plus a deep carriage rumble (30–100 Hz) with its
//   harmonic shadow. No slow swells.
// Variants for the listening lab:
//   a: classic jointed track: a clear da-dum.
//   b: softer clacks, more rolling roar and rattle, the same rhythm.
const TRAIN_VARIANTS = {
  a: { clack: 1, metal: 1, roll: 0.35, rattle: 0.5, gain: 1 },
  b: { clack: 0.7, metal: 0.8, roll: 0.42, rattle: 1, gain: 1.11 },
};
const TRAIN_WHEEL_M = 2.83; // a wheel's circumference (0.9 m across)

class Train {
  constructor(variant) {
    this.v = TRAIN_VARIANTS[variant] || TRAIN_VARIANTS.a;
    this.base = rand(75, 85) / 3.6; // m/s
    this.speed = new Drift(0.9, 1.1, 60, 180);
    this.pink = [new Pink(), new Pink()];
    this.brown = [new Brown(), new Brown()];
    this.rollHp = [new OnePole(80), new OnePole(80)]; // a gentle high-pass: x minus its low-passed self
    this.rollLp = [new Biquad("lowpass", 1000, 0.6), new Biquad("lowpass", 1000, 0.6)];
    this.rumbleLp = [new Biquad("lowpass", 100, 0.7), new Biquad("lowpass", 100, 0.7)];
    this.shadow = [new Shadow(150, 500), new Shadow(150, 500)]; // of the rumble and the thumps together
    this.thumps = new Rings(16);
    this.metal = new Rings(48);
    this.rattle = new Bursts(24);
    this.flutter = [rand(0, TWO_PI), rand(0, TWO_PI)];
    this.hits = []; // the next hits of this cycle: [samples from now, level]
    this.cycleLeft = Math.round(rand(0.2, 0.8) * sampleRate);
    this.rattleLeft = 0;
    this.rattleGap = 0;
    this.low = [0, 0, 0, 0];
    this.mid = [0, 0, 0, 0];
    this.mps = this.base;
  }

  // A new rail joint: the near bogie's pair now, the far bogie's quieter pair half a cycle later.
  newCycle() {
    const sr = sampleRate;
    const cycle = 25 / this.mps;
    const axles = 2.5 / this.mps;
    const jitter = () => rand(0.98, 1.02);
    this.hits = [
      [0, 1], [axles * jitter(), 0.85],
      [(cycle / 2) * jitter(), 0.55], [(cycle / 2 + axles) * jitter(), 0.5],
    ].map(([s, level]) => [Math.round(s * sr), level]);
    this.cycleLeft = Math.round(cycle * jitter() * sr);
  }

  hit(level) {
    const v = this.v;
    const amp = level * rand(0.75, 1) * v.clack;
    const pan = rand(-0.25, 0.25);
    const wet = level < 0.7 ? 0.2 : 0.1; // the far bogie is a little more distant
    this.thumps.add(amp * 0.8, rand(50, 150), rand(0.03, 0.07), pan, wet);
    for (let k = 2 + Math.floor(Math.random() * 3); k > 0; k--) {
      this.metal.add(amp * v.metal * rand(0.25, 0.7), rand(600, 3000), 0.005 * Math.pow(8, Math.random()), pan, wet);
    }
    this.rattleLeft = Math.round((2 + Math.random() * 4) * v.rattle);
    this.rattleGap = Math.round(rand(0.008, 0.025) * sampleRate);
  }

  next(out) {
    const v = this.v;
    this.mps = this.base * this.speed.next();
    if (--this.cycleLeft <= 0) this.newCycle();
    for (const h of this.hits) {
      if (h[0]-- === 0) this.hit(h[1]);
    }
    if (this.rattleLeft > 0 && --this.rattleGap <= 0) {
      this.rattle.add(rand(0.01, 0.04) * v.rattle, rand(1500, 5000), rand(1, 3), 0.00003, rand(0.0003, 0.001), rand(-0.6, 0.6), 0.15);
      this.rattleLeft--;
      this.rattleGap = Math.round(rand(0.008, 0.03) * sampleRate);
    }
    const lo = this.low;
    lo[0] = 0; lo[1] = 0; lo[2] = 0; lo[3] = 0;
    this.thumps.mix(lo);
    const m = this.mid;
    m[0] = 0; m[1] = 0; m[2] = 0; m[3] = 0;
    this.metal.mix(m);
    this.rattle.mix(m);
    const wheelHz = this.mps / TRAIN_WHEEL_M;
    for (let c = 0; c < 2; c++) {
      this.flutter[c] += (TWO_PI * wheelHz) / sampleRate;
      if (this.flutter[c] > TWO_PI) this.flutter[c] -= TWO_PI;
      const flutter = 1 + 0.12 * fastSin(this.flutter[c]);
      const p = this.pink[c].next(white());
      const roll = this.rollLp[c].next(p - this.rollHp[c].next(p)) * 1.6 * v.roll * flutter;
      const rumble = this.rumbleLp[c].next(this.brown[c].next(white())) * 1.2;
      // One shadow for the deep rumble and the thumps: the rumble's share at 1.2, the thumps' at 1.5.
      const shadow = this.shadow[c].next(rumble + lo[c] * 1.25) * 1.2;
      // The hits share one soft limit, so even the loudest stays well under full scale.
      out[c] = ((roll + rumble) * 0.92 + softClip(lo[c] + shadow + m[c], 1.6)) * v.gain;
      out[c + 2] = ((roll + rumble) * 0.08 + softClip(lo[c + 2] + m[c + 2], 1.6)) * v.gain;
    }
  }
}

// ---------- Airplane ----------

// Airplane: a passenger jet's cabin in cruise.
// - Airflow (the turbulent air along the fuselage): steady broadband noise with a smooth spectrum,
//   absolutely steady.
// - Engine: a low exhaust rumble (40–150 Hz) with its harmonic shadow, and a stable drone of 6
//   partials (a fundamental at about 85–115 Hz and harmonics up to about 600 Hz), two engines a
//   fraction of a hertz apart so they beat very slowly. Clearly there, never whiny.
// - Air vent: a faint, steady high hiss at 3–8 kHz.
// Variants for the listening lab:
//   a: a middle or rear seat: the airflow's maximum around 300–1000 Hz, more engine.
//   b: a front seat: brighter airflow (its peak around 1–3 kHz), less engine.
const AIRPLANE_VARIANTS = {
  a: { flowHz: 550, flowQ: 0.5, bright: 0.12, engine: 1, drone: 1, gain: 1 },
  b: { flowHz: 1800, flowQ: 0.5, bright: 0.3, engine: 0.5, drone: 0.8, gain: 0.72 },
};
const DRONE_PARTIALS = [0.08, 0.28, 0.55, 0.6, 0.65, 0.55];

class Airplane {
  constructor(variant) {
    this.v = AIRPLANE_VARIANTS[variant] || AIRPLANE_VARIANTS.a;
    this.pink = [new Pink(), new Pink()];
    this.brown = [new Brown(), new Brown()];
    this.flow = [new Biquad("bandpass", this.v.flowHz, this.v.flowQ), new Biquad("bandpass", this.v.flowHz, this.v.flowQ)];
    this.top = [new OnePole(6000), new OnePole(6000)];
    this.exhaustLp = [new Biquad("lowpass", 150, 0.7), new Biquad("lowpass", 150, 0.7)];
    this.shadow = [new Shadow(150, 600), new Shadow(150, 600)];
    this.vent = [new Biquad("bandpass", 5000, 0.7), new Biquad("bandpass", 5000, 0.7)];
    const f0 = rand(85, 115);
    this.hz = [f0, f0 + rand(0.15, 0.4)]; // two engines, beating very slowly
    this.phase = [rand(0, TWO_PI), rand(0, TWO_PI)];
  }

  // One engine's drone: its partials from one sine and cosine (sin((k+1)x) = 2cos(x)sin(kx) − sin((k−1)x)).
  drone(x) {
    const c2 = 2 * fastCos(x);
    let prev = 0;
    let cur = fastSin(x);
    let sum = 0;
    for (let k = 0; k < DRONE_PARTIALS.length; k++) {
      sum += cur * DRONE_PARTIALS[k];
      const next = c2 * cur - prev;
      prev = cur;
      cur = next;
    }
    return sum;
  }

  next(out) {
    const v = this.v;
    for (let k = 0; k < 2; k++) {
      this.phase[k] += (TWO_PI * this.hz[k]) / sampleRate;
      if (this.phase[k] > TWO_PI) this.phase[k] -= TWO_PI;
    }
    const e1 = this.drone(this.phase[0]);
    const e2 = this.drone(this.phase[1]);
    for (let c = 0; c < 2; c++) {
      const p = this.pink[c].next(white());
      const flow = this.flow[c].next(p) * 1.8 + this.top[c].next(p) * v.bright;
      const ex = this.exhaustLp[c].next(this.brown[c].next(white())) * 0.9 * v.engine;
      const exhaust = ex + this.shadow[c].next(ex) * 1.2;
      // Each side hears its own engine a little more.
      const drone = (c === 0 ? e1 * 0.6 + e2 * 0.4 : e1 * 0.4 + e2 * 0.6) * 0.075 * v.drone;
      const vent = this.vent[c].next(white()) * 0.03;
      const y = flow + exhaust + drone + vent;
      out[c] = y * 0.95 * v.gain;
      out[c + 2] = y * 0.05 * v.gain;
    }
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

// The sounds, by the id focus-sound.js uses. A function gets the lab's variant ("a", "b", …).
const SOUNDS = {
  rain: () => new Rain(),
  thunder: (variant) => new Thunder(variant),
  birds: () => new Birds(),
  wind: () => new Wind(),
  fire: (variant) => new Fire(variant),
  waves: () => new WavesMix(),
  stream: () => new Stream(),
  crickets: () => new Crickets(),
  fan: () => new Fan(),
  vacuum: () => new Vacuum(),
  train: (variant) => new Train(variant),
  airplane: (variant) => new Airplane(variant),
};

// One node plays one sound (processorOptions.type, and .variant in the lab). Two stereo outputs:
// 0 is dry, 1 goes to the reverb. A "stopAt" message (an audio clock time, sent with the fade-out)
// ends it once the fade is over: it then tells the page ("ended") and stops running, so nothing keeps
// working in silence.
class FocusAmbientProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions || {};
    const make = SOUNDS[opts.type] || SOUNDS.fan;
    this.sound = make(opts.variant);
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
