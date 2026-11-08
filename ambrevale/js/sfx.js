'use strict';
/* petits effets sonores synthétisés (WebAudio, aucun fichier) */
const SFX = {
  ctx: null, muted: false, last: {},
  init() { try { this.muted = localStorage.getItem('ambrevale_mute') === '1'; } catch (e) { } },
  ac() {
    if (this.muted) return null;
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  toggle() { this.muted = !this.muted; try { localStorage.setItem('ambrevale_mute', this.muted ? '1' : '0'); } catch (e) { } },
  tone(f, d, type, vol, slide, delay) {
    const c = this.ac(); if (!c) return;
    const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  },
  noise(d, vol, freq) {
    const c = this.ac(); if (!c) return;
    const n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = freq || 800; g.gain.value = vol || 0.15;
    s.buffer = buf; s.connect(f).connect(g).connect(c.destination); s.start();
  },
  play(name) {
    const t = performance.now(), gap = { arrow: 90, boom: 120, zap: 120, hit: 80, die: 60 }[name] || 0;
    if (gap && t - (this.last[name] || 0) < gap) return; this.last[name] = t;
    switch (name) {
      case 'click': this.tone(660, 0.06, 'triangle', 0.05); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.035); this.tone(1319, 0.14, 'square', 0.035, null, 0.07); break;
      case 'build': this.tone(392, 0.12, 'triangle', 0.07); this.tone(523, 0.12, 'triangle', 0.07, null, 0.1); this.tone(784, 0.25, 'triangle', 0.07, null, 0.2); break;
      case 'arrow': this.tone(1400, 0.05, 'triangle', 0.015, 0.5); break;
      case 'boom': this.noise(0.35, 0.18, 400); this.tone(90, 0.3, 'sine', 0.12, 0.5); break;
      case 'zap': this.tone(1800, 0.12, 'sawtooth', 0.025, 0.3); break;
      case 'die': this.tone(300, 0.12, 'square', 0.02, 0.5); break;
      case 'crash': this.noise(0.6, 0.25, 600); break;
      case 'bolt': this.noise(0.5, 0.3, 2500); this.tone(70, 0.5, 'sine', 0.15, 0.6); break;
      case 'freeze': this.tone(2000, 0.4, 'sine', 0.05, 0.4); this.tone(2600, 0.4, 'sine', 0.03, 0.5, 0.05); break;
      case 'horn': this.tone(196, 0.9, 'sawtooth', 0.06, 1.02); this.tone(147, 1.1, 'sawtooth', 0.05, 1.0, 0.1); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.07, null, i * 0.12)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.07, null, i * 0.18)); break;
    }
  }
};
SFX.init();
