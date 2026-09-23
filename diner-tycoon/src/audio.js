// Tiny synthesized sound effects with WebAudio. No audio files needed.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  tone({ freq = 440, type = 'sine', duration = 0.12, gain = 0.2, slideTo = null, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  noise({ duration = 0.15, gain = 0.15, delay = 0, highpass = 2000 }) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  scan(combo = 1) {
    const f = 1100 + Math.min(combo, 12) * 40;
    this.tone({ freq: f, type: 'square', duration: 0.09, gain: 0.08 });
  }

  tooEarly() {
    this.tone({ freq: 500, type: 'triangle', duration: 0.1, gain: 0.1, slideTo: 380 });
  }

  buzz() {
    this.tone({ freq: 140, type: 'sawtooth', duration: 0.28, gain: 0.16, slideTo: 90 });
    this.noise({ duration: 0.12, gain: 0.06, highpass: 600 });
  }

  chaChing() {
    // bell + drawer slam + coins
    this.tone({ freq: 1568, type: 'sine', duration: 0.5, gain: 0.18 });
    this.tone({ freq: 2093, type: 'sine', duration: 0.45, gain: 0.12, delay: 0.04 });
    this.tone({ freq: 3136, type: 'sine', duration: 0.35, gain: 0.05, delay: 0.06 });
    this.noise({ duration: 0.2, gain: 0.2, delay: 0.18, highpass: 900 });
    for (let i = 0; i < 5; i++) this.tone({ freq: 2400 + Math.random() * 1600, type: 'triangle', duration: 0.08, gain: 0.05, delay: 0.25 + i * 0.045 });
  }

  pop() {
    this.tone({ freq: 700, type: 'sine', duration: 0.08, gain: 0.08, slideTo: 1300 });
  }

  bell() {
    this.tone({ freq: 880, type: 'sine', duration: 0.6, gain: 0.12 });
    this.tone({ freq: 1320, type: 'sine', duration: 0.5, gain: 0.06, delay: 0.02 });
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, type: 'triangle', duration: 0.16, gain: 0.1, delay: i * 0.09 }));
  }

  gameOver() {
    [392, 349, 311, 261].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', duration: 0.3, gain: 0.1, delay: i * 0.22 }));
  }
}

// ---------------------------------------------------------------- music
// A small procedural diner tune: walking bass, brushed hats, chord stabs and
// a pentatonic lead, scheduled a little ahead of time so it never stutters.
export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.playing = false;
    this.bpm = 118;
    this.step = 0;           // 16th-note counter
    this.nextTime = 0;
    this.timer = null;
    this.gainNode = null;
    this.volume = 0.5;
    this.progression = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]]; // C  F  G  F (semitones from C)
    this.bass = [0, 0, 7, 0, 5, 5, 12, 5, 7, 7, 2, 7, 5, 5, 0, 5];
    this.leadScale = [0, 2, 4, 7, 9, 12, 14, 16];
    this.leadPattern = [0, 2, 4, 2, 5, 4, 2, 0, 3, 5, 7, 5, 4, 2, 1, 0];
  }
  start() {
    const ctx = this.sfx.ensure();
    if (!ctx || this.playing) return;
    if (!this.gainNode) { this.gainNode = ctx.createGain(); this.gainNode.connect(ctx.destination); }
    this.gainNode.gain.value = this.volume;
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.1;
    this.tick();
  }
  stop() {
    this.playing = false;
    clearTimeout(this.timer);
  }
  toggle() { this.playing ? this.stop() : this.start(); return this.playing; }
  setVolume(v) { this.volume = v; if (this.gainNode) this.gainNode.gain.value = v; }
  tick() {
    if (!this.playing) return;
    const ctx = this.sfx.ctx;
    const stepLen = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.35) {
      this.schedule(this.step, this.nextTime, stepLen);
      this.nextTime += stepLen;
      this.step = (this.step + 1) % 64;
    }
    this.timer = setTimeout(() => this.tick(), 90);
  }
  note(freq, t, dur, type, gain, out = this.gainNode) {
    const ctx = this.sfx.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  hat(t, gain) {
    const ctx = this.sfx.ctx;
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(this.gainNode); src.start(t);
  }
  schedule(step, t, len) {
    if (this.sfx.muted) return;
    const bar = Math.floor(step / 16) % 4;
    const s16 = step % 16;
    const chord = this.progression[bar];
    const C2 = 65.41, C4 = 261.63;
    const semi = (base, n) => base * Math.pow(2, n / 12);
    // bass on every 8th, swung
    if (s16 % 2 === 0) this.note(semi(C2, this.bass[s16] + chord[0] - (this.bass[s16] >= 12 ? 12 : 0) * 0), t, len * 1.6, 'triangle', 0.16);
    // hats: swing feel
    if (s16 % 2 === 0) this.hat(t, 0.045);
    else this.hat(t + len * 0.12, 0.02);
    // chord stab on beats 2 and 4 (steps 4, 12), short
    if (s16 === 4 || s16 === 12) for (const n of chord) this.note(semi(C4 / 2, n), t, len * 1.2, 'square', 0.028);
    // lead melody, every other 16th, pentatonic over the chord
    if (s16 % 2 === 1 && Math.random() < 0.85) {
      const deg = this.leadPattern[(s16 + bar * 3) % 16];
      const freq = semi(C4, this.leadScale[deg % this.leadScale.length] + (bar === 2 ? 7 : bar === 1 || bar === 3 ? 5 : 0));
      this.note(freq, t, len * 1.7, 'sine', 0.07);
    }
  }
}

// ---------------------------------------------------------------- ambience
// Low murmur of a busy room: filtered noise whose level follows the crowd.
export class Ambience {
  constructor(sfx) { this.sfx = sfx; this.node = null; this.gain = null; }
  start() {
    const ctx = this.sfx.ensure();
    if (!ctx || this.node) return;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // brownish
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
    this.gain = ctx.createGain(); this.gain.gain.value = 0;
    src.connect(f).connect(this.gain).connect(ctx.destination); src.start();
    this.node = src;
  }
  setCrowd(n) {
    if (!this.gain) return;
    const target = this.sfx.muted ? 0 : Math.min(0.09, 0.012 * n);
    this.gain.gain.setTargetAtTime(target, this.sfx.ctx.currentTime, 0.5);
  }
}
