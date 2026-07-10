// Generative audio: a soft pad that follows the world's key, pentatonic
// plinks for the good things, filtered noise for the sharp ones.

const ROOTS = { 1: 220, 2: 246.9, 3: 196, 4: 174.6, 5: 233.1, 6: 207.7, 7: 185 };
const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.padNodes = null;
    this.worldId = 1;
    this.nextPluck = 0;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // gentle echo for plucks
      this.delay = this.ctx.createDelay(1.5);
      this.delay.delayTime.value = 0.42;
      this.fb = this.ctx.createGain();
      this.fb.gain.value = 0.34;
      this.delay.connect(this.fb).connect(this.delay);
      this.delay.connect(this.master);
      this.startPad();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  setWorld(id) {
    this.worldId = id;
    if (this.padNodes) {
      const f = (ROOTS[id] || 220) / 2;
      this.padNodes.o1.frequency.setTargetAtTime(f, this.ctx.currentTime, 1.2);
      this.padNodes.o2.frequency.setTargetAtTime(f * 1.5, this.ctx.currentTime, 1.2);
    }
  }

  startPad() {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0.05;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const o1 = c.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = (ROOTS[this.worldId] || 220) / 2;
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = o1.frequency.value * 1.5;
    o2.detune.value = 4;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(g.gain);
    o1.connect(lp); o2.connect(lp);
    lp.connect(g).connect(this.master);
    o1.start(); o2.start(); lfo.start();
    this.padNodes = { o1, o2 };
  }

  // ambient pluck, call from the game loop
  tick(t) {
    if (!this.ctx || this.muted) return;
    if (t < this.nextPluck) return;
    this.nextPluck = t + 2.2 + Math.random() * 4.5;
    const root = ROOTS[this.worldId] || 220;
    const f = root * PENTA[Math.floor(Math.random() * PENTA.length)] * (Math.random() < 0.3 ? 2 : 1);
    this.pluck(f, 0.05, 2.4);
  }

  pluck(freq, vol = 0.12, dur = 0.8, type = 'sine', dest = null) {
    if (!this.ensure() || this.muted) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(dest || this.delay);
    o.start();
    o.stop(c.currentTime + dur + 0.05);
  }

  noise(vol = 0.2, dur = 0.25, freq = 1800, type = 'highpass') {
    if (!this.ensure() || this.muted) return;
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  event(type) {
    const root = ROOTS[this.worldId] || 220;
    switch (type) {
      case 'diamond': this.pluck(root * 2, 0.14, 1.2); this.pluck(root * 3, 0.1, 1.4); break;
      case 'complete': {
        [1, 5 / 4, 3 / 2, 2].forEach((r, i) =>
          setTimeout(() => this.pluck(root * 2 * r, 0.13, 1.5), i * 110));
        break;
      }
      case 'death': this.noise(0.3, 0.4, 300, 'lowpass'); break;
      case 'shatter': this.noise(0.22, 0.3, 2600, 'highpass'); break;
      case 'burnt': break;
      case 'poof': this.noise(0.16, 0.25, 900, 'bandpass'); break;
      case 'pad': case 'switch': this.pluck(root * 1.5, 0.09, 0.25, 'square'); break;
      case 'gate-open': this.pluck(root * 2.5, 0.07, 0.5, 'triangle'); break;
      case 'gate-close': this.pluck(root * 1.25, 0.06, 0.4, 'triangle'); break;
      case 'key': case 'unlock': case 'coverlock': this.pluck(root * 2.25, 0.1, 0.8); break;
      case 'cover': this.pluck(root * 1.875, 0.08, 0.6); break;
      case 'ignite': case 'melt': this.noise(0.12, 0.3, 1200, 'bandpass'); break;
      case 'trim': this.noise(0.14, 0.15, 3200, 'highpass'); break;
      case 'merge': this.pluck(root * 2, 0.1, 1.0); this.pluck(root * 2.5, 0.08, 1.2); break;
      case 'prism': this.pluck(root * 2.5, 0.1, 1.0); this.pluck(root * 10 / 3, 0.06, 1.2); break;
      case 'echo-rec': this.pluck(root, 0.07, 0.5, 'triangle'); break;
      case 'echo-born': this.pluck(root * 1.5, 0.08, 0.9, 'triangle'); break;
      case 'length+': case 'length-': this.pluck(root * 1.25, 0.08, 0.5); break;
      case 'menu': this.pluck(root * 2, 0.05, 0.2, 'triangle'); break;
      case 'select': this.pluck(root * 3, 0.08, 0.5, 'triangle'); break;
      default: break;
    }
  }
}
