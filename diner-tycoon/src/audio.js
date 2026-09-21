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
