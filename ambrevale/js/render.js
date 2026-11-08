'use strict';
/* ==========================================================================
   Rendu isométrique — tout l'art est dessiné procéduralement sur canvas
   ========================================================================== */
const R = { canvas: null, ctx: null, W: 0, H: 0, dpr: 1, cam: { x: 0, y: 0, z: 1 }, island: null, islandMeta: null, t: 0, clouds: [], glows: [], night: 0 };

function initRender() {
  R.canvas = document.getElementById('game');
  R.ctx = R.canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); });
  buildIsland();
  for (let i = 0; i < 9; i++) R.clouds.push({ x: Math.random(), y: Math.random() * 0.8, s: rnd(0.6, 1.6), v: rnd(0.004, 0.012) });
  fitCamera();
}
function resizeCanvas() {
  R.dpr = Math.min(2, window.devicePixelRatio || 1);
  R.W = window.innerWidth; R.H = window.innerHeight;
  R.canvas.width = Math.round(R.W * R.dpr); R.canvas.height = Math.round(R.H * R.dpr);
}
function fitCamera() {
  const mapW = (MAP_N + 3) * TW, mapH = (MAP_N + 3) * TH + 120;
  let z = Math.min(R.W / mapW, (R.H - 150) / mapH) * 1.16;
  if (R.W < R.H) z = Math.max(z, R.W / (MAP_N * TW) * 1.55);   // portrait : plus proche, on fait glisser
  R.cam.z = clamp(z, 0.22, 2.2);
  R.cam.x = 0; R.cam.y = isoY(MAP_N / 2, MAP_N / 2) + 16;
}
function screenToGrid(sx, sy) {
  const wx = (sx - R.W / 2) / R.cam.z + R.cam.x;
  const wy = (sy - R.H / 2) / R.cam.z + R.cam.y;
  const a = wx / HW, b = wy / HH;
  return { gx: (a + b) / 2, gy: (b - a) / 2 };
}
function gridToScreen(gx, gy, z) {
  return { x: (isoX(gx, gy) - R.cam.x) * R.cam.z + R.W / 2, y: (isoY(gx, gy) - (z || 0) - R.cam.y) * R.cam.z + R.H / 2 };
}

/* ---------- primitives ---------- */
function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
function prism(ctx, x0, y0, x1, y1, z, h, col, edge) {
  const A = pt(x0, y0, z + h), B = pt(x1, y0, z + h), C = pt(x1, y1, z + h), D = pt(x0, y1, z + h);
  const c0 = pt(x1, y1, z), d0 = pt(x0, y1, z), b0 = pt(x1, y0, z);
  ctx.fillStyle = col; poly(ctx, [d0, c0, C, D]); ctx.fill();
  ctx.fillStyle = shade(col, -0.22); poly(ctx, [c0, b0, B, C]); ctx.fill();
  ctx.fillStyle = shade(col, 0.16); poly(ctx, [A, B, C, D]); ctx.fill();
  if (edge !== false) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(D[0], D[1]); ctx.lineTo(C[0], C[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
  }
}
function pyramid(ctx, x0, y0, x1, y1, z, h, col) {
  const A = pt(x0, y0, z), B = pt(x1, y0, z), C = pt(x1, y1, z), D = pt(x0, y1, z);
  const P = pt((x0 + x1) / 2, (y0 + y1) / 2, z + h);
  ctx.fillStyle = shade(col, 0.1); poly(ctx, [A, B, P]); ctx.fill();
  ctx.fillStyle = shade(col, -0.05); poly(ctx, [A, D, P]); ctx.fill();
  ctx.fillStyle = col; poly(ctx, [D, C, P]); ctx.fill();
  ctx.fillStyle = shade(col, -0.25); poly(ctx, [C, B, P]); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(C[0], C[1]); ctx.lineTo(P[0], P[1]); ctx.stroke();
}
function cylinder(ctx, gx, gy, r, z, h, col, topCol) {
  const [sx, sy] = pt(gx, gy, 0); const rx = r * HW * 1.414, ry = r * HH * 1.414;
  const g = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);
  g.addColorStop(0, shade(col, 0.08)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.32));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(sx + rx, sy - z - h); ctx.lineTo(sx + rx, sy - z);
  ctx.ellipse(sx, sy - z, rx, ry, 0, 0, Math.PI, false);
  ctx.lineTo(sx - rx, sy - z - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = topCol || shade(col, 0.15);
  ctx.beginPath(); ctx.ellipse(sx, sy - z - h, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function cone(ctx, gx, gy, r, z, h, col) {
  const [sx, sy] = pt(gx, gy, 0); const rx = r * HW * 1.414, ry = r * HH * 1.414;
  const g = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);
  g.addColorStop(0, shade(col, 0.12)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(sx + rx, sy - z); ctx.ellipse(sx, sy - z, rx, ry, 0, 0, Math.PI, false);
  ctx.lineTo(sx, sy - z - h); ctx.closePath(); ctx.fill();
}
function ellipseG(ctx, gx, gy, r, z, fill) {
  const [sx, sy] = pt(gx, gy, z); ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(sx, sy, r * HW * 1.414, r * HH * 1.414, 0, 0, Math.PI * 2); ctx.fill();
}
function faceL(ctx, x0, x1, yE, z0, z1, col) { poly(ctx, [pt(x0, yE, z0), pt(x1, yE, z0), pt(x1, yE, z1), pt(x0, yE, z1)]); ctx.fillStyle = col; ctx.fill(); }
function faceR(ctx, xE, y0, y1, z0, z1, col) { poly(ctx, [pt(xE, y0, z0), pt(xE, y1, z0), pt(xE, y1, z1), pt(xE, y0, z1)]); ctx.fillStyle = col; ctx.fill(); }
function glow(x, y, r, col, a) { R.glows.push({ x, y, r, col, a: a == null ? 1 : a }); }
function diamond(ctx, cx, cy, w, h, col) {
  ctx.fillStyle = shade(col, 0.25); poly(ctx, [[cx, cy - h], [cx + w, cy], [cx, cy + h * 0.15]]); ctx.fill();
  ctx.fillStyle = col; poly(ctx, [[cx, cy - h], [cx - w, cy], [cx, cy + h * 0.15]]); ctx.fill();
  ctx.fillStyle = shade(col, -0.25); poly(ctx, [[cx - w, cy], [cx, cy + h * 0.15], [cx, cy + h * 0.8]]); ctx.fill();
  ctx.fillStyle = shade(col, -0.4); poly(ctx, [[cx + w, cy], [cx, cy + h * 0.15], [cx, cy + h * 0.8]]); ctx.fill();
}

/* ---------- île (pré-rendue) ---------- */
function buildIsland() {
  const M = 1.4, N = MAP_N, SC = 2, CLIFF = 110;
  const ox = (N + 2 * M) * HW, oy = 2 * M * HH + 10;
  const w = Math.ceil(2 * (N + 2 * M) * HW), h = Math.ceil((2 * N + 4 * M) * HH + CLIFF + 20);
  const cv = document.createElement('canvas'); cv.width = w * SC; cv.height = h * SC;
  const c = cv.getContext('2d'); c.scale(SC, SC); c.translate(ox, oy);
  const rng = mulberry32(1234);
  // contour organique autour de la grille
  const edge = [];
  const corners = [[-M, -M], [N + M, -M], [N + M, N + M], [-M, N + M]];
  for (let s = 0; s < 4; s++) {
    const [ax, ay] = corners[s], [bx, by] = corners[(s + 1) % 4];
    for (let i = 0; i < 18; i++) {
      const t = i / 18; let gx = lerp(ax, bx, t), gy = lerp(ay, by, t);
      const j = (rng() - 0.3) * 0.8 + Math.sin(t * Math.PI) * 0.0;
      const nx = s === 0 ? 0 : s === 1 ? -1 : s === 2 ? 0 : 1; const ny = s === 0 ? 1 : s === 1 ? 0 : s === 2 ? -1 : 0;
      const cornerSoft = Math.min(t, 1 - t) < 0.08 ? 0.9 : 0;
      gx += nx * (j + cornerSoft); gy += ny * (j + cornerSoft);
      edge.push([gx, gy]);
    }
  }
  const E = edge.map(([gx, gy]) => pt(gx, gy, 0));
  // falaise : partie avant (bas d'écran)
  c.save();
  const cg = c.createLinearGradient(0, isoY(N, N) - 200, 0, isoY(N, N) + CLIFF);
  cg.addColorStop(0, '#9b7a58'); cg.addColorStop(0.5, '#6e5440'); cg.addColorStop(1, '#3a2c2a');
  c.fillStyle = cg;
  c.beginPath(); c.moveTo(E[0][0], E[0][1]);
  for (const p of E) c.lineTo(p[0], p[1]);
  c.closePath(); c.fill();
  for (let k = 0; k < E.length; k++) {
    const p = E[k], q = E[(k + 1) % E.length];
    const d1 = CLIFF * (0.75 + 0.25 * Math.sin(k * 1.7)), d2 = CLIFF * (0.75 + 0.25 * Math.sin((k + 1) * 1.7));
    c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.lineTo(q[0], q[1] + d2); c.lineTo(p[0], p[1] + d1); c.closePath();
    const lg = c.createLinearGradient(0, p[1], 0, p[1] + d1);
    const lit = q[0] < p[0];
    lg.addColorStop(0, lit ? '#a7835e' : '#8a6a4c'); lg.addColorStop(0.35, lit ? '#7d5f45' : '#634a37'); lg.addColorStop(1, '#2e2430');
    c.fillStyle = lg; c.fill();
  }
  // strates
  c.strokeStyle = 'rgba(40,25,20,0.25)'; c.lineWidth = 1.2;
  for (let s = 1; s < 5; s++) {
    c.beginPath();
    E.forEach((p, k) => { const y = p[1] + s * 18 + Math.sin(k * 2.1 + s) * 3; k ? c.lineTo(p[0], y) : c.moveTo(p[0], y); });
    c.stroke();
  }
  // herbe
  c.beginPath(); c.moveTo(E[0][0], E[0][1]); for (const p of E) c.lineTo(p[0], p[1]); c.closePath();
  const gg = c.createLinearGradient(0, isoY(0, 0), 0, isoY(N, N));
  gg.addColorStop(0, '#9ccf72'); gg.addColorStop(1, '#6fae58');
  c.fillStyle = gg; c.fill();
  c.strokeStyle = '#c9e59a'; c.lineWidth = 2.5; c.stroke();
  c.restore();
  // dalles
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const border = x === 0 || y === 0 || x === N - 1 || y === N - 1;
    poly(c, [pt(x, y), pt(x + 1, y), pt(x + 1, y + 1), pt(x, y + 1)]);
    if (border) { c.fillStyle = 'rgba(236,214,160,0.55)'; c.fill(); }
    else if ((x + y) % 2) { c.fillStyle = 'rgba(255,255,255,0.045)'; c.fill(); }
    else { c.fillStyle = 'rgba(0,40,0,0.025)'; c.fill(); }
  }
  // brins d'herbe et fleurs
  for (let i = 0; i < 1400; i++) {
    const gx = rnd(-M + 0.5, N + M - 0.5), gy = rnd(-M + 0.5, N + M - 0.5);
    const [sx, sy] = pt(gx, gy);
    if (rng() < 0.82) { c.strokeStyle = rng() < 0.5 ? 'rgba(60,110,40,0.35)' : 'rgba(200,240,160,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + rnd(-1.5, 1.5), sy - rnd(2, 5)); c.stroke(); }
    else { c.fillStyle = ['#fff6e0', '#f7c6d9', '#fbe38a', '#c7b8ff'][i % 4]; c.beginPath(); c.arc(sx, sy, 1.3, 0, 7); c.fill(); }
  }
  // arbres et rochers sur la lisière
  const deco = [];
  for (let i = 0; i < 70; i++) {
    const side = i % 4; const t = rng();
    let gx, gy; const d = -0.55 - rng() * (M - 0.7);
    if (side === 0) { gx = t * N; gy = d; } else if (side === 1) { gx = N - d; gy = t * N; } else if (side === 2) { gx = t * N; gy = N - d; } else { gx = d; gy = t * N; }
    deco.push({ gx, gy, kind: rng() < 0.72 ? 'tree' : 'rock', s: 0.7 + rng() * 0.6, hue: rng() });
  }
  deco.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
  for (const d of deco) d.kind === 'tree' ? drawTree(c, d.gx, d.gy, d.s, d.hue) : drawRock(c, d.gx, d.gy, d.s);
  R.island = cv; R.islandMeta = { ox, oy, w, h, SC };
}
function drawTree(c, gx, gy, s, hue) {
  const [x, y] = pt(gx, gy);
  c.fillStyle = 'rgba(30,50,20,0.25)'; c.beginPath(); c.ellipse(x + 4, y + 2, 14 * s, 6 * s, 0, 0, 7); c.fill();
  c.fillStyle = '#7a5638'; c.fillRect(x - 2 * s, y - 14 * s, 4 * s, 14 * s);
  const cols = hue < 0.6 ? ['#4f8f4a', '#62a659', '#86c06e'] : hue < 0.85 ? ['#3f7a52', '#53936a', '#77b48a'] : ['#c9884f', '#dca05c', '#efc27a'];
  for (let k = 0; k < 3; k++) {
    c.fillStyle = cols[k];
    c.beginPath(); c.arc(x - 3 * s + k * 2 * s, y - (20 + k * 7) * s, (12 - k * 2.5) * s, 0, 7); c.fill();
  }
}
function drawRock(c, gx, gy, s) {
  const [x, y] = pt(gx, gy);
  c.fillStyle = 'rgba(30,40,30,0.25)'; c.beginPath(); c.ellipse(x + 2, y + 2, 11 * s, 5 * s, 0, 0, 7); c.fill();
  c.fillStyle = '#a9a39a'; c.beginPath(); c.moveTo(x - 10 * s, y); c.lineTo(x - 6 * s, y - 9 * s); c.lineTo(x + 3 * s, y - 11 * s); c.lineTo(x + 10 * s, y - 2 * s); c.lineTo(x + 6 * s, y + 3 * s); c.closePath(); c.fill();
  c.fillStyle = '#c9c3b8'; c.beginPath(); c.moveTo(x - 6 * s, y - 9 * s); c.lineTo(x + 3 * s, y - 11 * s); c.lineTo(x + 1 * s, y - 4 * s); c.closePath(); c.fill();
}

/* ---------- bâtiments ---------- */
const TRIM = ['#b5875a', '#8e9ab2', '#e8b84a'];
const WALL_COL = ['#a77a4c', '#8d6a48', '#cfc5b0', '#b7b3aa', '#8e93a3', '#6f7f9e', '#7fd6d0', '#e8c25a'];
function tierOf(l) { return l >= 7 ? 2 : l >= 4 ? 1 : 0; }

function drawBuilding(ctx, b, t, ctxInfo) {
  const s = BUILDINGS[b.type].size, x = b.x, y = b.y, l = Math.max(1, b.lvl);
  ctx.save();
  if (b.flash > 0) ctx.translate(rnd(-1.5, 1.5), rnd(-1, 1));
  // ombre portée
  ctx.fillStyle = 'rgba(20,40,20,0.22)';
  poly(ctx, [pt(x + 0.05, y + 0.25), pt(x + s + 0.25, y + 0.05), pt(x + s + 0.35, y + s + 0.2), pt(x + 0.2, y + s + 0.35)]); ctx.fill();
  if (b.dead) { drawRubble(ctx, x, y, s, t, b); ctx.restore(); return; }
  if (b.lvl === 0) { drawConstruction(ctx, x, y, s, t); ctx.restore(); return; }
  const f = DRAW[b.type];
  if (f) f(ctx, x, y, s, l, b, t, ctxInfo || {});
  if (b.upg) drawScaffold(ctx, x, y, s, t);
  ctx.restore();
}
function drawRubble(ctx, x, y, s, t, b) {
  prism(ctx, x + 0.15, y + 0.15, x + s - 0.15, y + s - 0.15, 0, 3, '#7b7368', false);
  const r = mulberry32((x * 31 + y * 17) | 0);
  for (let i = 0; i < 4 + s * 2; i++) {
    const gx = x + 0.3 + r() * (s - 0.6), gy = y + 0.3 + r() * (s - 0.6), w = 0.12 + r() * 0.15;
    prism(ctx, gx, gy, gx + w, gy + w, 3, 3 + r() * 6, r() < 0.5 ? '#9a9186' : '#6d655c', false);
  }
  if (Math.random() < 0.04 && b.type !== 'wall') Particles.smoke(x + s / 2, y + s / 2, 8);
}
function drawConstruction(ctx, x, y, s, t) {
  prism(ctx, x + 0.15, y + 0.15, x + s - 0.15, y + s - 0.15, 0, 5, '#b9a98c');
  const p = s * 0.18;
  prism(ctx, x + p + 0.2, y + p, x + p + 0.55, y + p + 0.35, 5, 10, '#a77a4c');
  prism(ctx, x + s - p - 0.6, y + s - p - 0.5, x + s - p - 0.2, y + s - p - 0.15, 5, 8, '#8d6a48');
  drawScaffold(ctx, x, y, s, t);
}
function drawScaffold(ctx, x, y, s, t) {
  ctx.strokeStyle = 'rgba(120,85,50,0.9)'; ctx.lineWidth = 2;
  const H = Math.min(60, 22 + s * 14);
  const cs = [[x + 0.1, y + s - 0.1], [x + s - 0.1, y + s - 0.1], [x + s - 0.1, y + 0.1]];
  ctx.beginPath();
  for (const [gx, gy] of cs) { const a = pt(gx, gy, 0), b = pt(gx, gy, H); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  for (const hh of [H * 0.45, H]) { const a = pt(cs[0][0], cs[0][1], hh), b = pt(cs[1][0], cs[1][1], hh), c2 = pt(cs[2][0], cs[2][1], hh); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); }
  ctx.stroke();
  // grue qui oscille
  const top = pt(x + s - 0.1, y + s - 0.1, H), ang = Math.sin(t * 0.8) * 0.5;
  ctx.strokeStyle = '#e8b84a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(top[0] + Math.cos(ang) * 26, top[1] - 8 + Math.sin(ang) * 6); ctx.stroke();
}

const DRAW = {
  citadel(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    const stone = ['#e8dcc2', '#e4e0d6', '#f1e8d2'][tr], roof = ['#4f6fb3', '#3c5aa6', '#2f4f9a'][tr], trim = TRIM[tr];
    const H = 46 + l * 2;
    prism(ctx, x + 0.12, y + 0.12, x + s - 0.12, y + s - 0.12, 0, 9, '#a69a86');
    const tur = (gx, gy) => { cylinder(ctx, gx, gy, 0.3, 9, H + 6, stone); prism(ctx, gx - 0.3, gy - 0.3, gx + 0.3, gy + 0.3, H + 15, 0.01, stone, false); cone(ctx, gx, gy, 0.38, H + 15, 26, roof); const p = pt(gx, gy, H + 43); ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fill(); };
    tur(x + 0.55, y + 0.55);
    prism(ctx, x + 0.55, y + 0.55, x + s - 0.55, y + s - 0.55, 9, H, stone);
    // bandeau
    faceL(ctx, x + 0.55, x + s - 0.55, y + s - 0.55, 9 + H - 6, 9 + H - 2, trim);
    faceR(ctx, x + s - 0.55, y + 0.55, y + s - 0.55, 9 + H - 6, 9 + H - 2, shade(trim, -0.2));
    // fenêtres
    for (let i = 0; i < 3; i++) {
      const xa = x + 0.85 + i * 0.5;
      faceL(ctx, xa, xa + 0.16, y + s - 0.55, 22, 34, '#ffd77a');
      const ya = y + 0.85 + i * 0.5;
      faceR(ctx, x + s - 0.55, ya, ya + 0.16, 22, 34, '#e8b95e');
      const p1 = pt(xa + 0.08, y + s - 0.55, 28), p2 = pt(x + s - 0.55, ya + 0.08, 28);
      glow(p1[0], p1[1], 10, '#ffcf6a', 0.5); glow(p2[0], p2[1], 10, '#ffcf6a', 0.5);
    }
    // porte
    faceL(ctx, x + 1.3, x + 1.7, y + s - 0.55, 9, 24, '#5a3e2b');
    pyramid(ctx, x + 0.45, y + 0.45, x + s - 0.45, y + s - 0.45, 9 + H, 36, roof);
    tur(x + 0.55, y + s - 0.55); tur(x + s - 0.55, y + 0.55); tur(x + s - 0.55, y + s - 0.55);
    // drapeau
    const top = pt(x + s / 2, y + s / 2, 9 + H + 36);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(top[0], top[1] - 24); ctx.stroke();
    ctx.fillStyle = trim; ctx.beginPath(); ctx.moveTo(top[0], top[1] - 24);
    for (let i = 0; i <= 6; i++) ctx.lineTo(top[0] + i * 3.2, top[1] - 24 + Math.sin(t * 4 + i * 0.8) * 1.6 + i * 0.4);
    for (let i = 6; i >= 0; i--) ctx.lineTo(top[0] + i * 3.2, top[1] - 14 + Math.sin(t * 4 + i * 0.8) * 1.6 + i * 0.2);
    ctx.fill();
  },
  goldmine(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    prism(ctx, x + 0.15, y + 0.15, x + s - 0.15, y + s - 0.15, 0, 6, '#8d7a62');
    pyramid(ctx, x + 0.3, y + 0.3, x + s - 0.3, y + s - 0.3, 6, 26, '#7d6a55');
    const e = pt(x + 1, y + s - 0.42, 6); ctx.fillStyle = '#2b211b'; ctx.beginPath(); ctx.ellipse(e[0], e[1] - 6, 7, 8, 0, Math.PI, 0); ctx.lineTo(e[0] + 7, e[1]); ctx.lineTo(e[0] - 7, e[1]); ctx.fill();
    // portique + roue
    const p1 = pt(x + 0.5, y + 1, 6), p2 = pt(x + 1.5, y + 1, 6), w = pt(x + 1, y + 1, 50);
    ctx.strokeStyle = shade(TRIM[tr], -0.2); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(w[0], w[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    const sp = b.upg ? 0 : t * 1.6;
    ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w[0], w[1], 10, 0, 7); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = sp + i * Math.PI / 4; ctx.moveTo(w[0] + Math.cos(a) * 10, w[1] + Math.sin(a) * 10); ctx.lineTo(w[0] - Math.cos(a) * 10, w[1] - Math.sin(a) * 10); } ctx.stroke();
    ctx.fillStyle = TRIM[tr]; ctx.beginPath(); ctx.arc(w[0], w[1], 2.5, 0, 7); ctx.fill();
    // pépites
    const fill = b.fill == null ? 0.4 : b.fill;
    const n = 2 + Math.round(fill * 7);
    for (let i = 0; i < n; i++) {
      const gx = x + 1.35 + (i % 3) * 0.17, gy = y + 1.45 + Math.floor(i / 3) * 0.12;
      const p = pt(gx, gy, 7 + Math.floor(i / 3) * 3);
      ctx.fillStyle = '#e0a92e'; ctx.beginPath(); ctx.arc(p[0], p[1], 3.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe48a'; ctx.beginPath(); ctx.arc(p[0] - 1, p[1] - 1, 1.4, 0, 7); ctx.fill();
    }
    if (fill > 0.3 && Math.random() < 0.03) Particles.sparkle(x + 1.5, y + 1.5, 12, '#ffe48a');
  },
  sapwell(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    prism(ctx, x + 0.15, y + 0.15, x + s - 0.15, y + s - 0.15, 0, 5, '#b9ad98');
    cylinder(ctx, x + 1, y + 1, 0.74, 5, 13, '#d8cfbd');
    const c = pt(x + 1, y + 1, 18); const rx = 0.6 * HW * 1.414, ry = 0.6 * HH * 1.414;
    const g = ctx.createRadialGradient(c[0], c[1], 1, c[0], c[1], rx);
    g.addColorStop(0, '#e2c8ff'); g.addColorStop(0.6, '#9a63e6'); g.addColorStop(1, '#5b2fa8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c[0], c[1], rx, ry, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
    const rp = Math.abs(t * 0.6) % 1; ctx.beginPath(); ctx.ellipse(c[0], c[1], rx * rp, ry * rp, 0, 0, 7); ctx.stroke();
    // piliers
    for (const [gx, gy] of [[x + 0.45, y + 1], [x + 1.55, y + 1]]) { cylinder(ctx, gx, gy, 0.08, 18, 22, TRIM[tr]); }
    const a = pt(x + 0.45, y + 1, 40), bb = pt(x + 1.55, y + 1, 40);
    ctx.strokeStyle = TRIM[tr]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + bb[0]) / 2, a[1] - 14, bb[0], bb[1]); ctx.stroke();
    // cristal flottant
    const cp = pt(x + 1, y + 1, 30 + Math.sin(t * 2) * 3 + (b.fill || 0) * 4);
    diamond(ctx, cp[0], cp[1], 6, 14, '#b07cf0');
    glow(cp[0], cp[1], 30, '#b07cf0', 0.8);
  },
  goldvault(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    prism(ctx, x + 0.18, y + 0.18, x + s - 0.18, y + s - 0.18, 0, 6, '#b3a78f');
    prism(ctx, x + 0.38, y + 0.38, x + s - 0.38, y + s - 0.38, 6, 20, ['#9a6a3d', '#6f6f7f', '#7c4a8a'][tr]);
    for (const xa of [x + 0.62, x + 1.25]) faceL(ctx, xa, xa + 0.12, y + s - 0.38, 6, 26, TRIM[Math.max(1, tr)]);
    for (const ya of [y + 0.62, y + 1.25]) faceR(ctx, x + s - 0.38, ya, ya + 0.12, 6, 26, shade(TRIM[Math.max(1, tr)], -0.2));
    prism(ctx, x + 0.34, y + 0.34, x + s - 0.34, y + s - 0.34, 26, 7, ['#7d522c', '#55556a', '#5e356b'][tr]);
    const lk = pt(x + 1, y + s - 0.38, 17); ctx.fillStyle = '#f3c64d'; ctx.fillRect(lk[0] - 3, lk[1] - 4, 6, 7);
    const fill = b.fill || 0;
    for (let i = 0; i < Math.round(fill * 8); i++) {
      const p = pt(x + 0.6 + (i % 4) * 0.22, y + 0.7 + Math.floor(i / 4) * 0.4, 34 + (i % 2) * 2);
      ctx.fillStyle = '#e8b13a'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 5, 2.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe48a'; ctx.beginPath(); ctx.ellipse(p[0], p[1] - 1, 3.6, 1.6, 0, 0, 7); ctx.fill();
    }
  },
  sapvault(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    prism(ctx, x + 0.18, y + 0.18, x + s - 0.18, y + s - 0.18, 0, 6, '#b3a78f');
    cylinder(ctx, x + 1, y + 1, 0.72, 6, 6, '#cfc6b5');
    const fill = clamp(b.fill == null ? 0.5 : b.fill, 0.05, 1);
    ctx.globalAlpha = 0.92; cylinder(ctx, x + 1, y + 1, 0.56, 12, 34 * fill, '#8f55e0', '#c9a2ff'); ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.25; cylinder(ctx, x + 1, y + 1, 0.6, 12, 36, '#e8f4ff', 'rgba(255,255,255,0.3)'); ctx.globalAlpha = 1;
    const hl = pt(x + 0.75, y + 1.15, 18); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hl[0], hl[1]); ctx.lineTo(hl[0], hl[1] - 22); ctx.stroke();
    cylinder(ctx, x + 1, y + 1, 0.66, 48, 5, TRIM[tr]);
    const o = pt(x + 1, y + 1, 58); ctx.fillStyle = '#c9a2ff'; ctx.beginPath(); ctx.arc(o[0], o[1], 3.5, 0, 7); ctx.fill();
    glow(o[0], o[1] + 20, 26, '#a77bea', 0.5);
  },
  barracks(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    prism(ctx, x + 0.15, y + 0.15, x + s - 0.15, y + s - 0.15, 0, 6, '#a39784');
    prism(ctx, x + 0.32, y + 0.32, x + s - 0.32, y + s - 0.32, 6, 24, ['#d9cdb4', '#d5d2cb', '#ece3cf'][tr]);
    faceL(ctx, x + 0.8, x + 1.2, y + s - 0.32, 6, 20, '#5a3e2b');
    pyramid(ctx, x + 0.22, y + 0.22, x + s - 0.22, y + s - 0.22, 30, 22, ['#c0584f', '#b04a5a', '#9a3d6a'][tr]);
    // épées croisées
    const c = pt(x + s - 0.32, y + 1, 18);
    ctx.strokeStyle = '#e9e9f2'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c[0] - 6, c[1] - 6); ctx.lineTo(c[0] + 6, c[1] + 4); ctx.moveTo(c[0] + 6, c[1] - 8); ctx.lineTo(c[0] - 6, c[1] + 6); ctx.stroke();
    // bannière
    const p = pt(x + 0.35, y + s - 0.35, 6);
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p[0] - 6, p[1]); ctx.lineTo(p[0] - 6, p[1] - 50); ctx.stroke();
    ctx.fillStyle = '#c0584f'; ctx.beginPath(); ctx.moveTo(p[0] - 6, p[1] - 50);
    ctx.lineTo(p[0] - 6 - 12, p[1] - 48 + Math.sin(t * 3) * 1.5); ctx.lineTo(p[0] - 6 - 12, p[1] - 34 + Math.sin(t * 3 + 1) * 1.5); ctx.lineTo(p[0] - 6 - 6, p[1] - 38); ctx.lineTo(p[0] - 6, p[1] - 34); ctx.fill();
    ctx.fillStyle = TRIM[2]; ctx.beginPath(); ctx.arc(p[0] - 12, p[1] - 44, 2, 0, 7); ctx.fill();
  },
  camp(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    ellipseG(ctx, x + 1, y + 1, 0.85, 0, 'rgba(160,125,80,0.55)');
    const tents = [[x + 0.55, y + 0.6], [x + 1.45, y + 0.55], [x + 0.6, y + 1.45]];
    const tc = ['#e7d7b0', '#d6c49a', '#efe2c2'][tr];
    for (const [gx, gy] of tents) { cone(ctx, gx, gy, 0.36, 0, 26, tc); const p = pt(gx, gy, 26); ctx.fillStyle = '#c0584f'; ctx.fillRect(p[0], p[1] - 7, 6, 4); ctx.strokeStyle = '#6b4a30'; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 8); ctx.stroke(); }
    const f = pt(x + 1.4, y + 1.4, 0);
    ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f[0] - 6, f[1] + 1); ctx.lineTo(f[0] + 6, f[1] - 1); ctx.moveTo(f[0] - 5, f[1] - 2); ctx.lineTo(f[0] + 5, f[1] + 2); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const hh = 8 + Math.sin(t * 9 + i * 2) * 3;
      ctx.fillStyle = ['#ff8a3d', '#ffc14d', '#fff1a8'][i];
      ctx.beginPath(); ctx.moveTo(f[0] - 5 + i * 2, f[1]); ctx.quadraticCurveTo(f[0], f[1] - hh * (1.4 - i * 0.3), f[0] + 5 - i * 2, f[1]); ctx.fill();
    }
    glow(f[0], f[1] - 4, 34, '#ff9a4a', 0.9);
  },
  archer(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l); const H = 42 + tr * 7;
    const col = ['#b58a5e', '#d8d0c0', '#efe8da'][tr];
    prism(ctx, x + 0.2, y + 0.2, x + s - 0.2, y + s - 0.2, 0, 6, '#a69a86');
    prism(ctx, x + 0.55, y + 0.55, x + s - 0.55, y + s - 0.55, 6, H, col);
    faceL(ctx, x + 0.9, x + 1.1, y + s - 0.55, H - 12, H - 2, '#3a2c22');
    prism(ctx, x + 0.38, y + 0.38, x + s - 0.38, y + s - 0.38, 6 + H, 7, TRIM[tr]);
    const z = 13 + H;
    const cren = [[x + 0.38, y + 0.38], [x + 0.88, y + 0.38], [x + 0.38, y + 0.88], [x + 1.38, y + 0.38], [x + 0.38, y + 1.38]];
    for (const [gx, gy] of cren) prism(ctx, gx, gy, gx + 0.24, gy + 0.24, z, 7, col, false);
    // archer
    const p = pt(x + 1, y + 1, z + 4);
    ctx.fillStyle = '#3d5a96'; ctx.beginPath(); ctx.arc(p[0], p[1] - 4, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0d2b0'; ctx.beginPath(); ctx.arc(p[0], p[1] - 10, 3, 0, 7); ctx.fill();
    const a = b.aim || 0.8; const dx = Math.cos(a) - Math.sin(a), dy = (Math.cos(a) + Math.sin(a)) * 0.5;
    ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p[0] + dx * 5, p[1] - 5 + dy * 5, 5, Math.atan2(dy, dx) - 1.2, Math.atan2(dy, dx) + 1.2); ctx.stroke();
    for (const [gx, gy] of [[x + 1.38, y + 1.38], [x + 0.88, y + 1.38], [x + 1.38, y + 0.88]]) prism(ctx, gx, gy, gx + 0.24, gy + 0.24, z, 7, col, false);
  },
  cannon(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    prism(ctx, x + 0.2, y + 0.2, x + s - 0.2, y + s - 0.2, 0, 5, '#a69a86');
    cylinder(ctx, x + 1, y + 1, 0.74, 5, 11, ['#a8a49c', '#9aa0ae', '#c9b98a'][tr]);
    cylinder(ctx, x + 1, y + 1, 0.55, 16, 3, '#6d6a66');
    const a = b.aim == null ? 0.8 : b.aim; const rec = (b.recoil || 0) * 0.25;
    const len = 0.85 + tr * 0.08;
    const s0 = pt(x + 1 - Math.cos(a) * (0.15 + rec), y + 1 - Math.sin(a) * (0.15 + rec), 24);
    const s1 = pt(x + 1 + Math.cos(a) * (len - rec), y + 1 + Math.sin(a) * (len - rec), 27);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2e3038'; ctx.lineWidth = 10 + tr; ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
    ctx.strokeStyle = '#555a66'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s0[0], s0[1] - 2); ctx.lineTo(s1[0], s1[1] - 2); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = TRIM[tr]; ctx.beginPath(); ctx.arc(s1[0], s1[1], 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b1c22'; ctx.beginPath(); ctx.arc(s1[0], s1[1], 2.5, 0, 7); ctx.fill();
    const c = pt(x + 1, y + 1, 24); ctx.fillStyle = '#3a3d45'; ctx.beginPath(); ctx.arc(c[0], c[1], 6, 0, 7); ctx.fill();
  },
  arcane(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    prism(ctx, x + 0.2, y + 0.2, x + s - 0.2, y + s - 0.2, 0, 8, '#6e6a8c');
    prism(ctx, x + 0.5, y + 0.5, x + s - 0.5, y + s - 0.5, 8, 34, ['#5b5f9e', '#4b5aa8', '#43408f'][tr]);
    faceL(ctx, x + 0.9, x + 1.1, y + s - 0.5, 14, 36, '#7ff0e0');
    faceR(ctx, x + s - 0.5, y + 0.9, y + 1.1, 14, 36, '#5fd0c4');
    pyramid(ctx, x + 0.42, y + 0.42, x + s - 0.42, y + s - 0.42, 42, 22, ['#6f74c0', '#5f6fd0', '#5a50b8'][tr]);
    const z = 82 + Math.sin(t * 2.2) * 4;
    const c = pt(x + 1, y + 1, z);
    ctx.strokeStyle = 'rgba(127,240,224,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(c[0], c[1] + 4, 14, 5, Math.sin(t) * 0.3, 0, 7); ctx.stroke();
    diamond(ctx, c[0], c[1], 7, 16, b.charge ? '#c9fff7' : '#5fe0d0');
    glow(c[0], c[1], 36, '#5fe0d0', 0.9);
  },
  frost(ctx, x, y, s, l, b, t) {
    const tr = tierOf(l);
    prism(ctx, x + 0.2, y + 0.2, x + s - 0.2, y + s - 0.2, 0, 5, '#b9c9d6');
    for (const [gx, gy, h] of [[x + 0.45, y + 0.5, 16], [x + 1.45, y + 0.4, 12], [x + 0.4, y + 1.45, 14], [x + 1.5, y + 1.45, 18]]) pyramid(ctx, gx - 0.15, gy - 0.15, gx + 0.15, gy + 0.15, 5, h, '#cfeaff');
    prism(ctx, x + 0.68, y + 0.68, x + s - 0.68, y + s - 0.68, 5, 46 + tr * 4, '#e3f1fb');
    faceL(ctx, x + 0.93, x + 1.07, y + s - 0.68, 14, 44, '#7fd8ff');
    faceR(ctx, x + s - 0.68, y + 0.93, y + 1.07, 14, 44, '#5fb8e6');
    pyramid(ctx, x + 0.62, y + 0.62, x + s - 0.62, y + s - 0.62, 51 + tr * 4, 18, '#bfe3f7');
    const c = pt(x + 1, y + 1, 30); glow(c[0], c[1], 34, '#8fdcff', 0.6 + Math.sin(t * 3) * 0.2);
  },
  wall(ctx, x, y, s, l, b, t, info) {
    const col = WALL_COL[clamp(l - 1, 0, 7)];
    const n = info.wallAt || (() => false);
    if (n(x - 1, y)) prism(ctx, x - 0.28, y + 0.32, x + 0.28, y + 0.68, 0, 16, col, false);
    if (n(x, y - 1)) prism(ctx, x + 0.32, y - 0.28, x + 0.68, y + 0.28, 0, 16, col, false);
    prism(ctx, x + 0.24, y + 0.24, x + 0.76, y + 0.76, 0, 20, col);
    prism(ctx, x + 0.2, y + 0.2, x + 0.8, y + 0.8, 20, 4, shade(col, 0.1), false);
  }
};

/* ---------- unités ---------- */
function drawUnit(ctx, u, t) {
  const d = UNITS[u.type]; const sz = d.size * 1.55 * (u.elite ? 1.35 : 1);
  const z = d.air ? 42 + Math.sin(t * 3 + u.bob) * 4 : Math.abs(Math.sin(t * 9 + u.bob)) * (u.moving ? 2 : 0);
  const g = pt(u.x, u.y, 0), p = pt(u.x, u.y, z);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(g[0], g[1], sz * 0.9, sz * 0.4, 0, 0, 7); ctx.fill();
  // anneau d'équipe
  ctx.strokeStyle = u.team === 'player' ? 'rgba(90,167,255,0.85)' : 'rgba(255,90,100,0.85)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(g[0], g[1], sz * 0.95, sz * 0.45, 0, 0, 7); ctx.stroke();
  const f = u.face || 1;
  const col = u.frozenT > 0 ? '#bfe9ff' : u.hitFlash > 0 ? '#ffffff' : d.color;
  const cx = p[0], cy = p[1] - sz;
  if (u.type === 'wyvern') {
    const flap = Math.sin(t * 10 + u.bob) * 0.6;
    ctx.fillStyle = shade(d.color, -0.25);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 16, cy - 8 - flap * 10); ctx.lineTo(cx - 6, cy + 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 16, cy - 8 - flap * 10); ctx.lineTo(cx + 6, cy + 2); ctx.fill();
  }
  const gr = ctx.createRadialGradient(cx - sz * 0.35, cy - sz * 0.4, 1, cx, cy, sz);
  gr.addColorStop(0, shade(col.startsWith('#') ? col : '#ffffff', 0.35)); gr.addColorStop(1, col.startsWith('#') ? shade(col, -0.2) : col);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, sz, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  // détails
  const sw = u.atkAnim > 0 ? Math.sin(u.atkAnim * 20) * 0.8 : 0;
  ctx.lineWidth = 2;
  switch (u.type) {
    case 'marauder': ctx.strokeStyle = '#e9e9f2'; ctx.beginPath(); ctx.moveTo(cx + f * sz * 0.7, cy); ctx.lineTo(cx + f * (sz + 6), cy - 6 + sw * 8); ctx.stroke();
      ctx.fillStyle = '#8c8c96'; ctx.beginPath(); ctx.arc(cx, cy - sz * 0.5, sz * 0.55, Math.PI, 0); ctx.fill(); break;
    case 'scout': ctx.fillStyle = '#3e6e33'; ctx.beginPath(); ctx.moveTo(cx - sz, cy - sz * 0.3); ctx.lineTo(cx, cy - sz * 1.6); ctx.lineTo(cx + sz, cy - sz * 0.3); ctx.fill(); break;
    case 'archerU': ctx.strokeStyle = '#7a5638'; ctx.beginPath(); ctx.arc(cx + f * sz * 0.6, cy, sz * 0.9, f > 0 ? -1.2 : Math.PI - 1.2, f > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke(); break;
    case 'sapper': ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx + f * sz * 0.9, cy - 2, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = Math.sin(t * 20) > 0 ? '#ffd14d' : '#ff6a3d'; ctx.beginPath(); ctx.arc(cx + f * sz * 0.9 + 2, cy - 6, 1.6, 0, 7); ctx.fill(); break;
    case 'brute': ctx.fillStyle = '#5b4a8a'; ctx.fillRect(cx - sz * 0.8, cy - sz * 0.2, sz * 1.6, sz * 0.4);
      ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + f * sz * 0.8, cy); ctx.lineTo(cx + f * (sz + 8), cy - 10 + sw * 10); ctx.stroke();
      if (u.elite) { ctx.fillStyle = '#f0c24f'; ctx.beginPath(); ctx.moveTo(cx - 6, cy - sz); ctx.lineTo(cx - 4, cy - sz - 6); ctx.lineTo(cx, cy - sz - 2); ctx.lineTo(cx + 4, cy - sz - 6); ctx.lineTo(cx + 6, cy - sz); ctx.fill(); } break;
    case 'shaman': ctx.strokeStyle = '#7a5638'; ctx.beginPath(); ctx.moveTo(cx + f * sz, cy + sz); ctx.lineTo(cx + f * sz, cy - sz - 6); ctx.stroke();
      ctx.fillStyle = '#c9fff2'; ctx.beginPath(); ctx.arc(cx + f * sz, cy - sz - 7, 2.5, 0, 7); ctx.fill(); glow(cx + f * sz, cy - sz - 7, 14, '#5fe0c0', 0.7); break;
    case 'wyvern': ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(cx + f * 3, cy - 2, 1.6, 0, 7); ctx.fill(); break;
  }
  // yeux
  if (u.type !== 'wyvern') { ctx.fillStyle = '#1b1b22'; ctx.fillRect(cx + f * 1.5 - 1, cy - 1.5, 2, 2); }
  if (u.hp < u.maxHp) hpBar(ctx, cx, cy - sz - 8, Math.max(14, sz * 2.2), u.hp / u.maxHp, u.team === 'player' ? '#5aa7ff' : '#ff5a64');
  if (u.frozenT > 0) { ctx.fillStyle = 'rgba(190,235,255,0.45)'; ctx.beginPath(); ctx.arc(cx, cy, sz + 3, 0, 7); ctx.fill(); }
}
function hpBar(ctx, x, y, w, r, col) {
  ctx.fillStyle = 'rgba(10,12,24,0.75)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  ctx.fillStyle = r > 0.5 ? col : r > 0.25 ? '#f0c24f' : '#ff5a64'; ctx.fillRect(x - w / 2, y, w * clamp(r, 0, 1), 3);
}

/* ---------- particules ---------- */
const Particles = {
  list: [],
  add(p) { if (this.list.length < 900) this.list.push(p); },
  sparkle(gx, gy, z, col) { this.add({ x: gx + rnd(-0.3, 0.3), y: gy + rnd(-0.3, 0.3), z, vx: 0, vy: 0, vz: rnd(10, 25), life: 0.9, max: 0.9, col, size: 2, kind: 'spark' }); },
  smoke(gx, gy, z) { this.add({ x: gx + rnd(-0.3, 0.3), y: gy + rnd(-0.3, 0.3), z, vx: rnd(-0.2, 0.2), vy: rnd(-0.2, 0.2), vz: rnd(14, 26), life: 1.6, max: 1.6, col: '#6b6560', size: rnd(4, 8), kind: 'smoke' }); },
  burst(gx, gy, z, col, n, spd) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(0.5, 1) * (spd || 2); this.add({ x: gx, y: gy, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd(20, 80), g: 160, life: rnd(0.4, 0.9), max: 0.9, col, size: rnd(1.5, 3.5), kind: 'spark' }); } },
  debris(gx, gy, n) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(0.5, 2); this.add({ x: gx, y: gy, z: rnd(10, 40), vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd(40, 110), g: 260, life: rnd(0.7, 1.2), max: 1.2, col: ['#9a9186', '#c9bfa8', '#6d655c'][i % 3], size: rnd(2, 4.5), kind: 'debris' }); } },
  ring(gx, gy, r, col, life) { this.add({ x: gx, y: gy, z: 0, vx: 0, vy: 0, vz: 0, life: life || 0.5, max: life || 0.5, col, size: r, kind: 'ring' }); },
  text(gx, gy, z, txt, col) { this.add({ x: gx, y: gy, z, vx: 0, vy: 0, vz: 30, life: 1.2, max: 1.2, col, txt, kind: 'text' }); },
  bolt(gx, gy) { this.add({ x: gx, y: gy, z: 0, life: 0.35, max: 0.35, kind: 'bolt', seed: Math.random() * 1000 }); },
  zap(x1, y1, z1, x2, y2, z2) { this.add({ x: x1, y: y1, z: z1, x2, y2, z2, life: 0.18, max: 0.18, kind: 'zap', seed: Math.random() * 1000 }); },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life -= dt;
      if (p.life <= 0) { L.splice(i, 1); continue; }
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.z += (p.vz || 0) * dt;
      if (p.g) { p.vz -= p.g * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } }
    }
  },
  draw(ctx) {
    for (const p of this.list) {
      const a = p.life / p.max; const s = pt(p.x, p.y, p.z);
      if (p.kind === 'spark' || p.kind === 'debris') { ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = p.col; ctx.fillRect(s[0] - p.size / 2, s[1] - p.size / 2, p.size, p.size); if (p.kind === 'spark') glow(s[0], s[1], p.size * 4, p.col, a * 0.5); }
      else if (p.kind === 'smoke') { ctx.globalAlpha = a * 0.35; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(s[0], s[1], p.size * (2 - a), 0, 7); ctx.fill(); }
      else if (p.kind === 'ring') { ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = 2.5; const r = p.size * (1.2 - a * 0.7); ctx.beginPath(); ctx.ellipse(s[0], s[1], r * HW * 1.414, r * HH * 1.414, 0, 0, 7); ctx.stroke(); }
      else if (p.kind === 'text') { ctx.globalAlpha = Math.min(1, a * 2); ctx.font = '700 13px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,30,0.8)'; ctx.strokeText(p.txt, s[0], s[1]); ctx.fillStyle = p.col; ctx.fillText(p.txt, s[0], s[1]); }
      else if (p.kind === 'bolt') {
        ctx.globalAlpha = a; const r = mulberry32(p.seed | 0); ctx.strokeStyle = '#eaf6ff'; ctx.lineWidth = 3;
        ctx.beginPath(); let x = s[0], y = s[1] - 420; ctx.moveTo(x, y);
        while (y < s[1]) { y += 30; x += (r() - 0.5) * 40; ctx.lineTo(x, Math.min(y, s[1])); }
        ctx.stroke(); glow(s[0], s[1], 90, '#bfe3ff', a);
      } else if (p.kind === 'zap') {
        const e = pt(p.x2, p.y2, p.z2); const r = mulberry32((p.seed + p.life * 50) | 0);
        ctx.globalAlpha = a / p.max * 0.9; ctx.strokeStyle = '#a8fff2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s[0], s[1]);
        for (let k = 1; k < 6; k++) ctx.lineTo(lerp(s[0], e[0], k / 6) + (r() - 0.5) * 14, lerp(s[1], e[1], k / 6) + (r() - 0.5) * 14);
        ctx.lineTo(e[0], e[1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
};

/* ---------- scène ---------- */
function drawBackground(ctx) {
  const n = R.night;
  const g = ctx.createLinearGradient(0, 0, 0, R.H);
  const top = n > 0.5 ? '#0f1532' : '#5f86c4', mid = n > 0.5 ? '#25305e' : '#a9c4e4', bot = n > 0.5 ? '#4b3f6e' : '#f2dcb6';
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, R.W, R.H);
  if (n > 0.5) {
    const r = mulberry32(77);
    for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(R.t + i)); ctx.fillStyle = '#fff'; ctx.fillRect(r() * R.W, r() * R.H * 0.7, 1.5, 1.5); }
    ctx.globalAlpha = 1;
  }
  for (const c of R.clouds) {
    c.x += c.v * 0.016; if (c.x > 1.25) c.x = -0.25;
    const x = c.x * R.W, y = c.y * R.H, s = c.s * Math.max(0.7, R.W / 1400);
    ctx.fillStyle = n > 0.5 ? 'rgba(160,170,220,0.10)' : 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y, 90 * s, 22 * s, 0, 0, 7); ctx.ellipse(x + 40 * s, y - 12 * s, 50 * s, 22 * s, 0, 0, 7); ctx.ellipse(x - 40 * s, y - 6 * s, 44 * s, 18 * s, 0, 0, 7); ctx.fill();
  }
}

function drawScene(scene, dt) {
  const ctx = R.ctx; R.t += dt; R.glows = [];
  R.night = scene.night ? 1 : 0;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  drawBackground(ctx);
  const z = R.cam.z;
  ctx.setTransform(R.dpr * z, 0, 0, R.dpr * z, R.dpr * (R.W / 2 - R.cam.x * z), R.dpr * (R.H / 2 - R.cam.y * z));
  const m = R.islandMeta;
  // l'île flotte doucement
  ctx.drawImage(R.island, -m.ox, -m.oy, m.w, m.h);
  // calques au sol
  if (scene.ground) scene.ground(ctx);
  // tri en profondeur
  const items = [];
  const wallSet = new Set();
  for (const b of scene.buildings) if (b.type === 'wall' && !b.dead) wallSet.add(b.x + ',' + b.y);
  const info = { wallAt: (x, y) => wallSet.has(x + ',' + y) };
  for (const b of scene.buildings) { const s = BUILDINGS[b.type].size; items.push({ d: b.x + b.y + s, b }); }
  for (const u of scene.units || []) items.push({ d: u.x + u.y + (UNITS[u.type].air ? 60 : 0), u });
  items.sort((a, b) => a.d - b.d);
  for (const it of items) { if (it.b) drawBuilding(ctx, it.b, R.t, info); else drawUnit(ctx, it.u, R.t); }
  if (scene.ghost) scene.ghost(ctx);
  // projectiles
  for (const p of scene.projs || []) drawProj(ctx, p);
  Particles.draw(ctx);
  // nuit + lumières
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  if (R.night) { ctx.fillStyle = 'rgba(12,16,48,0.42)'; ctx.fillRect(0, 0, R.W, R.H); }
  ctx.setTransform(R.dpr * z, 0, 0, R.dpr * z, R.dpr * (R.W / 2 - R.cam.x * z), R.dpr * (R.H / 2 - R.cam.y * z));
  ctx.globalCompositeOperation = 'lighter';
  for (const g of R.glows) {
    const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    gr.addColorStop(0, rgba(g.col, (R.night ? 0.55 : 0.22) * g.a)); gr.addColorStop(1, rgba(g.col, 0));
    ctx.fillStyle = gr; ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  if (scene.overlay) scene.overlay(ctx);
  // vignette
  const v = ctx.createRadialGradient(R.W / 2, R.H / 2, Math.min(R.W, R.H) * 0.45, R.W / 2, R.H / 2, Math.max(R.W, R.H) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,8,25,0.38)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, R.W, R.H);
}

function drawProj(ctx, p) {
  const s = pt(p.x, p.y, p.z);
  if (p.kind === 'arrow' || p.kind === 'uarrow') {
    const b = pt(p.px, p.py, p.pz);
    ctx.strokeStyle = p.kind === 'arrow' ? '#fff3d6' : '#ffe08a'; ctx.lineWidth = 2;
    const dx = s[0] - b[0], dy = s[1] - b[1], L = Math.hypot(dx, dy) || 1;
    ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[0] - dx / L * 10, s[1] - dy / L * 10); ctx.stroke();
  } else if (p.kind === 'ball') {
    const g = pt(p.x, p.y, 0); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(g[0], g[1], 4, 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#25262c'; ctx.beginPath(); ctx.arc(s[0], s[1], 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#6d7080'; ctx.beginPath(); ctx.arc(s[0] - 1.5, s[1] - 1.5, 1.5, 0, 7); ctx.fill();
  } else if (p.kind === 'bolt') {
    ctx.fillStyle = '#d8fffa'; ctx.beginPath(); ctx.arc(s[0], s[1], 4, 0, 7); ctx.fill();
    glow(s[0], s[1], 26, '#5fe0d0', 1);
  } else if (p.kind === 'fire') {
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(s[0], s[1], 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.arc(s[0], s[1], 2.5, 0, 7); ctx.fill();
    glow(s[0], s[1], 26, '#ff8a3d', 1);
  }
}

// icônes des bâtiments pour la boutique
const _iconCache = {};
function buildingIcon(type, lvl) {
  const key = type + lvl;
  if (_iconCache[key]) return _iconCache[key];
  const s = BUILDINGS[type].size, W = 150, H = 140;
  const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
  const c = cv.getContext('2d'); c.scale(2, 2);
  const sc = type === 'citadel' ? 0.85 : s === 1 ? 1.8 : 1.15;
  c.translate(W / 2, H - 22); c.scale(sc, sc);
  const cx = isoX(s / 2, s / 2), cy = isoY(s / 2, s / 2);
  c.translate(-cx, -cy - (s === 1 ? 0 : 0));
  const saved = R.glows; R.glows = [];
  drawBuilding(c, { type, lvl, x: 0, y: 0, fill: 0.6, aim: 0.8 }, 1.2, {});
  R.glows = saved;
  _iconCache[key] = cv.toDataURL();
  return _iconCache[key];
}
function unitIcon(type) {
  const key = 'u_' + type;
  if (_iconCache[key]) return _iconCache[key];
  const cv = document.createElement('canvas'); cv.width = 120; cv.height = 120;
  const c = cv.getContext('2d'); c.scale(2, 2);
  c.translate(30, UNITS[type].air ? 82 : 46);
  const saved = R.glows; R.glows = [];
  drawUnit(c, { type, x: 0, y: 0, hp: 1, maxHp: 1, face: 1, team: 'player', bob: 0 }, 0.3);
  R.glows = saved;
  _iconCache[key] = cv.toDataURL();
  return _iconCache[key];
}
