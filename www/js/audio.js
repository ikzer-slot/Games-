// Sons synthétisés en WebAudio : aucun fichier à charger.
let ctx = null, enabled = true; const last = {};
export const setSound = (on) => { enabled = on; };
export const soundOn = () => enabled;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(f, d, type = 'sine', v = 0.1, slide = 0, delay = 0) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + d + 0.02);
}
function buzz(d, v = 0.05) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), l = a.createOscillator(), lg = a.createGain(), g = a.createGain();
  o.type = 'sawtooth'; o.frequency.value = 180; l.frequency.value = 28; lg.gain.value = 25;
  l.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(v, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
  o.connect(g).connect(a.destination); o.start(); l.start(); o.stop(a.currentTime + d); l.stop(a.currentTime + d);
}
const S = {
  plant: () => tone(500, 0.08, 'triangle', 0.09, 250),
  build: () => { tone(220, 0.1, 'triangle', 0.12); tone(330, 0.12, 'triangle', 0.1, 0, 0.08); },
  honey: () => tone(1100, 0.07, 'sine', 0.04, 300),
  shoot: () => tone(300, 0.08, 'triangle', 0.05, -150),
  hit: () => tone(700, 0.04, 'square', 0.025),
  kill: () => tone(450, 0.08, 'triangle', 0.06, 400),
  hurt: () => tone(140, 0.35, 'sawtooth', 0.1, -60),
  wave: () => { buzz(0.9, 0.06); [196, 233, 294].forEach((f, i) => tone(f, 0.4, 'sine', 0.06, 0, i * 0.12)); },
  clear: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.09)),
  error: () => tone(150, 0.12, 'square', 0.05),
  click: () => tone(880, 0.03, 'sine', 0.04),
  bee: () => tone(1500, 0.05, 'sine', 0.03, -400),
};
export function sfx(n) {
  if (!enabled) return;
  const now = performance.now();
  if (last[n] && now - last[n] < 50) return;
  last[n] = now; S[n]?.();
}
