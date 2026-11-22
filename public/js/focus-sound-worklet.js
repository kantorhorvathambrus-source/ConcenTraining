// The Ambient focus sounds (Waves, Rain, Fire, Fan, Vacuum), generated live, sample by sample.
// This is an AudioWorklet module: it runs on the browser's audio thread, not on the page, and is
// loaded by focus-sound.js (audioWorklet.addModule). See "Focus sound" in the README.
//
// Why live and not a loop: every wave, raindrop and crackle is rolled from random numbers as it
// plays, so nothing ever repeats, however long the session. It needs no memory for samples, and
// it runs exactly as long as the page's audio does (with the screen locked too, where the browser
// keeps audio playing): no timers, which browsers pause in the background.
//
// Each sound comes out at roughly the same raw level; focus-sound.js (NOISE_LEVELS) sets the final
// level, matched to the noises. This file has no access to the page or its other scripts.

const TWO_PI = 2 * Math.PI;

function white() {
  return Math.random() * 2 - 1;
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

// A two-pole filter (the RBJ "audio EQ cookbook" biquad): "lowpass", "highpass" or "bandpass".
class Biquad {
  constructor(kind, hz, q) {
    const w0 = (TWO_PI * hz) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cos = Math.cos(w0);
    let b0, b1, b2;
    if (kind === "lowpass") {
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0;
    } else if (kind === "highpass") {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0;
    } else {
      b0 = alpha; b1 = 0; b2 = -alpha;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0; this.a2 = (1 - alpha) / a0;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
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
    this.from = lo + Math.random() * (hi - lo);
    this.to = this.from;
    this.left = 0;
    this.length = 1;
    this.value = this.from;
  }

  next() {
    if (this.left <= 0) {
      this.from = this.value;
      this.to = this.lo + Math.random() * (this.hi - this.lo);
      this.length = Math.round((this.minS + Math.random() * (this.maxS - this.minS)) * sampleRate);
      this.left = this.length;
    }
    this.left--;
    const p = 1 - this.left / this.length;
    this.value = this.from + (this.to - this.from) * (0.5 - 0.5 * Math.cos(Math.PI * p));
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
  return Math.max(1, Math.round((-Math.log(1 - Math.random()) / perSecond) * sampleRate));
}

// Short sounds (drops, crackles, pops) that play for a few ms and die away. A fixed pool, so
// nothing is created while playing; when it's full, a new event simply isn't played.
class Voices {
  constructor(size) {
    this.list = Array.from({ length: size }, () => ({ on: false }));
  }

  add(props) {
    const v = this.list.find((voice) => !voice.on);
    if (v) Object.assign(v, props, { on: true });
  }
}

// ---------- the sounds ----------

// Waves: brown and pink noise whose level follows one wave after another. Each wave has its own
// length (6–12 s), height, crest point and end level, so it never sounds like a metronome. The sound
// gets brighter at the crest (a low-pass opening up) with a little foam hiss, and drifts slowly
// between left and right.
class Waves {
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
    this.peak = 0.7 + Math.random() * 0.3;
    this.end = 0.3 + Math.random() * 0.15;
    this.crest = 0.4 + Math.random() * 0.2; // where in the wave the crest is
    this.length = Math.round((6 + Math.random() * 6) * sampleRate);
    this.pos = 0;
  }

  envelope() {
    if (this.pos >= this.length) this.newWave();
    const p = this.pos++ / this.length;
    if (p < this.crest) {
      const q = p / this.crest;
      return this.start + (this.peak - this.start) * (0.5 - 0.5 * Math.cos(Math.PI * q));
    }
    const q = (p - this.crest) / (1 - this.crest);
    // Falls quickly after the crest, then slowly runs out: like water drawing back.
    return this.end + (this.peak - this.end) * Math.pow(1 - q, 2.2);
  }

  next(out) {
    const env = this.envelope();
    this.level = env;
    if ((this.count++ & 63) === 0) {
      const hz = 450 + 1800 * env * env;
      for (const pair of this.lp) for (const f of pair) f.set(hz);
    }
    const [gl, gr] = panGains(this.pan.next());
    for (let c = 0; c < 2; c++) {
      const w = white();
      let x = this.brown[c].next(w) * 0.8 + this.pink[c].next(white()) * 0.5;
      x = this.lp[c][1].next(this.lp[c][0].next(x));
      const foam = this.foamHp[c].next(white()) * 0.08 * env * env * env;
      out[c] = (x * 1.6 + foam) * env * (c === 0 ? gl : gr);
    }
  }
}

// Rain: a soft bed (pink and brown, low-passed) plus droplets. Most droplets are tiny ticks of
// high-passed noise that die away within a few ms; about 1 in 25 is a soft "plink" (a short sine
// whose pitch rises a little, the sound of a drop hitting water). Every drop has its own time,
// loudness (mostly quiet, a few louder), brightness and place between left and right, and the rain
// itself gets slowly heavier and lighter.
class Rain {
  constructor() {
    this.pink = [new Pink(), new Pink()];
    this.brown = [new Brown(), new Brown()];
    this.bedLp = [new Biquad("lowpass", 2800, 0.6), new Biquad("lowpass", 2800, 0.6)];
    this.voices = new Voices(96);
    this.intensity = new Drift(0.7, 1.25, 6, 18);
    this.gap = nextGap(500);
    // The drops are softened a little: without it their ticks reach up to the very top of hearing
    // and the rain sizzles.
    this.dropLp = [new OnePole(7000), new OnePole(7000)];
  }

  drop() {
    const r = Math.random();
    const [gl, gr] = panGains(Math.random() * 1.8 - 0.9);
    if (Math.random() < 0.04) {
      const hz = 1200 + Math.random() * 2600;
      this.voices.add({
        kind: 1, amp: 0.05 + 0.12 * r * r, env: 1, decay: Math.exp(-1 / (sampleRate * (0.006 + Math.random() * 0.012))),
        phase: 0, inc: (TWO_PI * hz) / sampleRate, chirp: 1 + (0.6 + Math.random() * 1.4) / sampleRate * 10, gl, gr,
      });
    } else {
      this.voices.add({
        kind: 0, amp: 0.08 + 0.9 * Math.pow(r, 5), env: 1, decay: Math.exp(-1 / (sampleRate * (0.0006 + Math.random() * 0.0025))),
        tone: 0.3 + Math.random() * 0.65, last: 0, gl, gr,
      });
    }
  }

  next(out) {
    const intensity = this.intensity.next();
    if (--this.gap <= 0) {
      this.drop();
      this.gap = nextGap(500 * intensity);
    }
    let dl = 0;
    let dr = 0;
    for (const v of this.voices.list) {
      if (!v.on) continue;
      let s;
      if (v.kind === 0) {
        // Differenced noise (a high-pass); tone mixes some of the plain noise back in: duller ticks.
        const w = white();
        s = (w - v.tone * v.last) * v.amp * v.env;
        v.last = w;
      } else {
        v.phase += v.inc;
        v.inc *= v.chirp;
        s = Math.sin(v.phase) * v.amp * v.env;
      }
      v.env *= v.decay;
      if (v.env < 0.001) v.on = false;
      dl += s * v.gl;
      dr += s * v.gr;
    }
    for (let c = 0; c < 2; c++) {
      const bed = this.bedLp[c].next(this.pink[c].next(white()) * 0.9 + this.brown[c].next(white()) * 0.5);
      out[c] = bed * (0.5 + 0.2 * intensity) + this.dropLp[c].next(c === 0 ? dl : dr);
    }
  }
}

// Fire: a low, warm rumble that slowly breathes, a faint hiss, crackles and pops. Crackles are tiny
// bursts of bright noise (1–6 ms) that come in irregular clusters: a few now and then, and every
// few seconds a quick run of them, like wood catching. Pops are rarer, lower and a little longer.
// Their loudness follows a steep curve: most are quiet, a few stand out.
class Fire {
  constructor() {
    this.brown = [new Brown(), new Brown()];
    this.rumbleLp = [new Biquad("lowpass", 350, 0.6), new Biquad("lowpass", 350, 0.6)];
    this.pink = [new Pink(), new Pink()];
    this.whooshLp = [new Biquad("lowpass", 900, 0.6), new Biquad("lowpass", 900, 0.6)];
    // The deepest bass (under about 70 Hz) adds little you can hear but takes most of the headroom.
    this.bedHp = [new Biquad("highpass", 70, 0.7), new Biquad("highpass", 70, 0.7)];
    this.hissHp = [new Biquad("highpass", 3500, 0.7), new Biquad("highpass", 3500, 0.7)];
    this.breath = [new Drift(0.55, 1, 0.8, 3), new Drift(0.55, 1, 0.8, 3)];
    this.voices = new Voices(48);
    // Crackles and pops are softened above about 6 kHz, where wood crackles have little energy:
    // without it they'd be sharp ticks rather than crackles.
    this.eventLp = [new OnePole(6000), new OnePole(6000)];
    this.burstLeft = 0; // samples left of a run of crackles
    this.crackleGap = nextGap(8);
    this.burstGap = nextGap(0.35);
    this.popGap = nextGap(0.3);
  }

  crackle(loud) {
    const r = Math.random();
    const [gl, gr] = panGains(Math.random() * 1.6 - 0.8);
    this.voices.add({
      amp: (0.07 + 0.55 * Math.pow(r, 5)) * loud, env: 1,
      decay: Math.exp(-1 / (sampleRate * (0.0008 + Math.random() * 0.0035))),
      lp: null, last: 0, tone: 0.5 + Math.random() * 0.5, gl, gr,
    });
  }

  pop() {
    const r = Math.random();
    const [gl, gr] = panGains(Math.random() * 1.2 - 0.6);
    const lp = new OnePole(600 + Math.random() * 1400);
    this.voices.add({
      amp: 0.25 + 0.5 * Math.pow(r, 3), env: 1,
      decay: Math.exp(-1 / (sampleRate * (0.006 + Math.random() * 0.012))),
      lp, last: 0, tone: 0.2, gl, gr,
    });
  }

  next(out) {
    if (--this.burstGap <= 0) {
      this.burstLeft = Math.round((0.15 + Math.random() * 0.9) * sampleRate);
      this.burstGap = nextGap(0.35);
    }
    const inBurst = this.burstLeft > 0;
    if (inBurst) this.burstLeft--;
    if (--this.crackleGap <= 0) {
      this.crackle(inBurst ? 0.8 : 1);
      this.crackleGap = nextGap(inBurst ? 70 : 8);
    }
    if (--this.popGap <= 0) {
      this.pop();
      this.popGap = nextGap(0.3);
    }
    let el = 0;
    let er = 0;
    for (const v of this.voices.list) {
      if (!v.on) continue;
      const w = white();
      let s = w - v.tone * v.last;
      v.last = w;
      if (v.lp) s = v.lp.next(w) * 3;
      s *= v.amp * v.env;
      v.env *= v.decay;
      if (v.env < 0.001) v.on = false;
      el += s * v.gl;
      er += s * v.gr;
    }
    for (let c = 0; c < 2; c++) {
      const breath = this.breath[c].next();
      const rumble = this.rumbleLp[c].next(this.brown[c].next(white())) * 0.38 * breath;
      const whoosh = this.whooshLp[c].next(this.pink[c].next(white())) * 0.9 * breath * breath;
      const hiss = this.hissHp[c].next(white()) * 0.05 * breath;
      // The rare loudest crackle or pop is rounded off (tanh, a soft limit), so even the biggest
      // one stays well under full scale at 100%. Too short for the rounding to be heard.
      const events = this.eventLp[c].next(c === 0 ? el : er);
      out[c] = this.bedHp[c].next(rumble + whoosh) + hiss + Math.tanh(events / 0.8) * 0.8;
    }
  }
}

// Fan: airy noise (pink and a little brown, low-passed, as from a fan or an air conditioner) with a
// very quiet motor hum at 100 Hz and its first harmonic, and a barely noticeable slow drift.
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
    const hum = (Math.sin(this.phase) * 0.05 + Math.sin(2 * this.phase) * 0.02) * d;
    for (let c = 0; c < 2; c++) {
      const air = this.lp[c].next(this.pink[c].next(white()) + this.brown[c].next(white()) * 0.35);
      out[c] = air * 1.3 * d + hum;
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
    for (let k = 0; k < this.harmonics.length; k++) motor += Math.sin((k + 1) * this.phase) * this.harmonics[k];
    motor += Math.sin(this.whinePhase) * 0.012;
    for (let c = 0; c < 2; c++) {
      const p = this.pink[c].next(white());
      const air = this.air[c].next(white()) * 0.55 + this.body[c].next(p) * 0.9;
      out[c] = air + motor;
    }
  }
}

const SOUNDS = { waves: Waves, rain: Rain, fire: Fire, fan: Fan, vacuum: Vacuum };

// One node plays one sound (processorOptions.type), in stereo. A "stopAt" message (an audio
// clock time, sent with the fade-out) ends it once the fade is over: it then tells the page
// ("ended") and stops running, so nothing keeps working in silence.
class FocusAmbientProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const Sound = SOUNDS[options.processorOptions && options.processorOptions.type] || Fan;
    this.sound = new Sound();
    this.stopAt = Infinity;
    this.frame = [0, 0];
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.stopAt === "number") this.stopAt = event.data.stopAt;
    };
  }

  process(inputs, outputs) {
    if (currentTime >= this.stopAt) {
      this.port.postMessage("ended");
      return false;
    }
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    const frame = this.frame;
    for (let i = 0; i < left.length; i++) {
      this.sound.next(frame);
      left[i] = frame[0];
      right[i] = frame[1];
    }
    return true;
  }
}

registerProcessor("focus-ambient", FocusAmbientProcessor);
