'use strict';
/* utilitaires */
function isoX(gx, gy) { return (gx - gy) * HW; }
function isoY(gx, gy) { return (gx + gy) * HH; }
function pt(gx, gy, z) { return [(gx - gy) * HW, (gx + gy) * HH - (z || 0)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rnd(a, b) { return a + Math.random() * (b - a); }
function rndi(a, b) { return Math.floor(rnd(a, b + 1)); }
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function fmtNum(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' M';
  if (n >= 1e5) return Math.floor(n / 1000) + ' k';
  return n.toLocaleString('fr-FR');
}
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  if (d) return d + 'j ' + (h ? h + 'h' : '');
  if (h) return h + 'h ' + (m ? m + 'm' : '');
  if (m) return m + 'm ' + (sec ? sec + 's' : '');
  return sec + 's';
}
const _shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  let v = _shadeCache.get(key);
  if (v) return v;
  let r, g, b;
  if (hex[0] === 'r') { [r, g, b] = hex.match(/[\d.]+/g).map(Number); }
  else {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    r = parseInt(c.substr(0, 2), 16); g = parseInt(c.substr(2, 2), 16); b = parseInt(c.substr(4, 2), 16);
  }
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  v = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  _shadeCache.set(key, v);
  return v;
}
function rgba(hex, a) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  return `rgba(${parseInt(c.substr(0, 2), 16)},${parseInt(c.substr(2, 2), 16)},${parseInt(c.substr(4, 2), 16)},${a})`;
}
function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function secondsToMidnight() { const d = new Date(); const m = new Date(d); m.setHours(24, 0, 0, 0); return (m - d) / 1000; }
function distToRect(px, py, x, y, s) {
  const dx = Math.max(x - px, 0, px - (x + s));
  const dy = Math.max(y - py, 0, py - (y + s));
  return Math.hypot(dx, dy);
}
function closestOnRect(px, py, x, y, s) { return [clamp(px, x, x + s), clamp(py, y, y + s)]; }
// coût en cristaux pour terminer instantanément
function gemCost(sec) { if (sec <= 10) return 0; return Math.max(1, Math.ceil(Math.pow(sec / 60, 0.72) * 1.1)); }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// petit tas binaire pour Dijkstra
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v; const top = v[0], tk = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    this.lastKey = tk;
    return top;
  }
}
