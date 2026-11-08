// Effets sonores synthétisés (aucun fichier audio à charger).
let ctx = null, enabled = true, last = {};
export function setSound(on) { enabled = on; }
export function soundOn() { return enabled; }
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}
function noise(dur, vol = 0.15) {
  const a = ac(); if (!a) return;
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900;
  s.buffer = buf; g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start();
}
const SFX = {
  plant: () => tone(520, 0.08, 'triangle', 0.1, 200),
  harvest: () => { tone(880, 0.08, 'sine', 0.1); setTimeout(() => tone(1320, 0.1, 'sine', 0.08), 60); },
  coin: () => { tone(1200, 0.06, 'square', 0.04); setTimeout(() => tone(1600, 0.08, 'square', 0.04), 50); },
  build: () => { tone(220, 0.1, 'triangle', 0.15); setTimeout(() => tone(330, 0.12, 'triangle', 0.12), 80); },
  shoot: () => tone(700, 0.04, 'triangle', 0.03, -300),
  flame: () => noise(0.15, 0.05),
  boom: () => { noise(0.35, 0.2); tone(90, 0.3, 'sine', 0.2, -50); },
  hurt: () => tone(160, 0.3, 'sawtooth', 0.12, -80),
  kill: () => tone(400, 0.06, 'triangle', 0.05, 300),
  night: () => [220, 277, 330].forEach((f, i) => setTimeout(() => tone(f, 0.6, 'sine', 0.07), i * 120)),
  day: () => [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.07), i * 100)),
  error: () => tone(140, 0.12, 'square', 0.06),
  click: () => tone(900, 0.03, 'sine', 0.05),
};
export function sfx(name) {
  if (!enabled) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 45) return; // limite les rafales
  last[name] = now;
  SFX[name]?.();
}
