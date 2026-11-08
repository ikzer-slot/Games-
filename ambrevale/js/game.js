'use strict';
/* ==========================================================================
   Contrôleur de jeu : village, placement, combats
   ========================================================================== */
const G = { mode: 'village', battle: null, plan: null, camp: null, sel: null, place: null, hover: null, spell: null,
  deploySel: null, deployHold: null, left: {}, deployed: {}, speed: 1, vision: false, visionCache: null, charges: {}, bubbles: [] };

function bAtState(x, y, ignoreId) {
  for (const b of S.buildings) { if (b.id === ignoreId) continue; const s = BUILDINGS[b.type].size; if (x >= b.x && x < b.x + s && y >= b.y && y < b.y + s) return b; }
  return null;
}
function fillOf(b) {
  const d = BUILDINGS[b.type];
  if (d.prod) return b.lvl >= 1 ? b.buf / d.cap(b.lvl) : 0;
  if (b.type === 'goldvault') return S.res.gold / Math.max(1, capacity('gold'));
  if (b.type === 'sapvault') return S.res.sap / Math.max(1, capacity('sap'));
  return 0.5;
}
function canPlace(type, x, y, ignoreId) {
  const s = BUILDINGS[type].size;
  if (x < 1 || y < 1 || x + s > MAP_N - 1 || y + s > MAP_N - 1) return false;
  for (const b of S.buildings) {
    if (b.id === ignoreId) continue; const bs = BUILDINGS[b.type].size;
    if (x < b.x + bs && x + s > b.x && y < b.y + bs && y + s > b.y) return false;
  }
  return true;
}
function findSpot(type) {
  const c = Math.floor(MAP_N / 2);
  for (let r = 0; r < MAP_N; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (canPlace(type, c + dx, c + dy)) return [c + dx, c + dy];
  }
  return null;
}
function lockReason(type) {
  const lim = limitOf(type), cnt = countType(type);
  if (cnt >= lim) {
    for (let l = CL() + 1; l <= 8; l++) if (LIMITS[type][l] > cnt) return `Citadelle niv. ${l} requise`;
    return 'Maximum atteint';
  }
  return '';
}

/* ---------- actions du village ---------- */
function startBuild(type) {
  const r = lockReason(type); if (r) return toast(r, 'bad');
  const d = BUILDINGS[type];
  if (!d.instant && buildersBusy() >= S.builders) return toast('Tous vos bâtisseurs sont occupés', 'bad');
  if (!canAfford(buildCost(type, 1))) return toast('Ressources insuffisantes', 'bad');
  const spot = findSpot(type); if (!spot) return toast('Plus de place !', 'bad');
  G.place = { type, gx: spot[0], gy: spot[1] }; G.sel = null;
  closeModal(); refreshUI();
}
function startMove(b) { G.place = { type: b.type, gx: b.x, gy: b.y, moveId: b.id }; G.sel = null; refreshUI(); }
function placeAt(gx, gy) {
  const p = G.place; if (!p) return;
  const s = BUILDINGS[p.type].size;
  const x = Math.round(gx - s / 2), y = Math.round(gy - s / 2);
  if (p.gx !== x || p.gy !== y) { p.gx = x; p.gy = y; return; }
  confirmPlace();
}
function confirmPlace() {
  const p = G.place; if (!p) return;
  if (!canPlace(p.type, p.gx, p.gy, p.moveId)) return toast('Emplacement occupé', 'bad');
  if (p.moveId) {
    const b = S.buildings.find(x => x.id === p.moveId); b.x = p.gx; b.y = p.gy;
    G.place = null; G.sel = b.id; G.visionCache = null; saveGame(); refreshUI(); return;
  }
  const d = BUILDINGS[p.type], cost = buildCost(p.type, 1);
  if (lockReason(p.type)) { G.place = null; refreshUI(); return toast(lockReason(p.type), 'bad'); }
  if (!canAfford(cost)) return toast('Ressources insuffisantes', 'bad');
  if (!d.instant && buildersBusy() >= S.builders) return toast('Tous vos bâtisseurs sont occupés', 'bad');
  spend(cost); SFX.play('click');
  const b = addBuilding(p.type, p.gx, p.gy, d.instant ? 1 : 0);
  if (!d.instant) { const T = buildTime(p.type, 1); b.upg = { end: now() + T * 1000 / DEV, total: T }; track('upgrade', 1); }
  Particles.debris(p.gx + s0(p.type) / 2, p.gy + s0(p.type) / 2, 8);
  G.visionCache = null;
  if (d.instant && !lockReason(p.type) && canAfford(cost)) {
    // les murailles s'enchaînent : on propose la case suivante
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const last = p.last || [1, 0];
    let nx = null;
    for (const dd of [last, ...dirs]) if (canPlace(p.type, p.gx + dd[0], p.gy + dd[1])) { nx = dd; break; }
    if (nx) { p.gx += nx[0]; p.gy += nx[1]; p.last = nx; }
  } else { G.place = null; G.sel = b.id; }
  saveGame(); refreshUI();
}
function s0(type) { return BUILDINGS[type].size; }
function upgradeBuilding(b) {
  const d = BUILDINGS[b.type], nl = b.lvl + 1;
  if (b.upg) return;
  if (nl > maxLvlOf(b.type)) return toast(nl > d.maxLvl ? 'Niveau maximum' : `Citadelle niv. ${nl - 1} requise`, 'bad');
  const cost = buildCost(b.type, nl);
  if (!canAfford(cost)) return toast('Ressources insuffisantes', 'bad');
  if (!d.instant && buildersBusy() >= S.builders) return toast('Tous vos bâtisseurs sont occupés', 'bad');
  if (d.prod && b.buf >= 1) collect(b, true);
  spend(cost);
  if (d.instant) { b.lvl = nl; Particles.burst(b.x + 0.5, b.y + 0.5, 20, '#ffe08a', 12, 1.2); }
  else { const T = buildTime(b.type, nl); b.upg = { end: now() + T * 1000 / DEV, total: T }; track('upgrade', 1); toast(`Amélioration lancée : ${d.name} → niv. ${nl}`, 'good'); }
  G.visionCache = null; saveGame(); refreshUI();
}
function upgradeAllWalls(lvl) {
  const walls = S.buildings.filter(b => b.type === 'wall' && b.lvl === lvl);
  if (lvl + 1 > maxLvlOf('wall')) return toast(`Citadelle niv. ${lvl} requise`, 'bad');
  let n = 0;
  for (const b of walls) { const c = buildCost('wall', lvl + 1); if (!canAfford(c)) break; spend(c); b.lvl++; n++; Particles.burst(b.x + 0.5, b.y + 0.5, 20, '#ffe08a', 6, 1); }
  if (!n) return toast('Ressources insuffisantes', 'bad');
  toast(`${n} muraille(s) améliorée(s)`, 'good'); G.visionCache = null; saveGame(); refreshUI();
}
function removeBuilding(b) {
  if (b.type !== 'wall') return;
  S.buildings = S.buildings.filter(x => x !== b); G.sel = null; G.visionCache = null; saveGame(); refreshUI();
}
function speedUp(b) {
  if (!b.upg) return;
  const g = gemCost((b.upg.end - now()) / 1000);
  if (S.res.gems < g) return toast('Pas assez de cristaux', 'bad');
  S.res.gems -= g; b.upg.end = now(); tickEconomyUI(); saveGame(); refreshUI();
}
function cancelUpgrade(b) {
  if (!b.upg) return;
  const c = buildCost(b.type, b.lvl + 1);
  for (const k in c) gain(k, Math.floor(c[k] * 0.5));
  b.upg = null;
  if (b.lvl === 0) { S.buildings = S.buildings.filter(x => x !== b); G.sel = null; }
  toast('Amélioration annulée (50 % remboursés)'); saveGame(); refreshUI();
}
function collect(b, silent) {
  const d = BUILDINGS[b.type]; if (!d.prod || b.buf < 1) return 0;
  const got = gain(d.prod, b.buf);
  if (got <= 0) { if (!silent) toast(`Stockage de ${d.prod === 'gold' ? 'or' : 'sève'} plein !`, 'bad'); return 0; }
  b.buf -= got;
  track(d.prod === 'gold' ? 'collectGold' : 'collectSap', got); SFX.play('coin');
  Particles.text(b.x + 1, b.y + 1, 60, '+' + fmtNum(got), d.prod === 'gold' ? '#ffd86a' : '#d6b4ff');
  for (let i = 0; i < 8; i++) Particles.sparkle(b.x + 1, b.y + 1, 40, d.prod === 'gold' ? '#ffe48a' : '#d6b4ff');
  return got;
}
function collectAll() {
  let n = 0; for (const b of S.buildings) n += collect(b, true);
  if (!n) toast('Rien à récolter pour le moment'); saveGame(); refreshUI();
}
function buyBuilder() {
  const c = BUILDER_COST[S.builders + 1];
  if (!c) return toast('Nombre maximum de bâtisseurs atteint');
  if (S.res.gems < c) return toast('Pas assez de cristaux', 'bad');
  S.res.gems -= c; S.builders++; toast('Un nouveau bâtisseur rejoint votre royaume !', 'good'); saveGame(); refreshUI();
}
function trainUnit(type, n) {
  const d = UNITS[type]; let k = 0;
  if (d.unlock > barracksLvl()) return toast(`Caserne niv. ${d.unlock} requise`, 'bad');
  for (let i = 0; i < n; i++) {
    if (housingUsed() + d.housing > housingCap()) { if (!k) toast('Campement plein', 'bad'); break; }
    if (S.res.sap < d.cost) { if (!k) toast('Pas assez de sève', 'bad'); break; }
    S.res.sap -= d.cost; S.trainQ.push({ type, left: d.time }); k++;
  }
  if (k) track('train', k);
  saveGame(); refreshUI();
}
function untrain(i) { const q = S.trainQ[i]; if (!q) return; S.res.sap = Math.min(capacity('sap'), S.res.sap + UNITS[q.type].cost); S.trainQ.splice(i, 1); saveGame(); refreshUI(); }
function finishTraining() {
  const nb = Math.max(1, S.buildings.filter(b => b.type === 'barracks' && b.lvl >= 1 && !b.upg).length);
  const sec = S.trainQ.reduce((a, q) => a + q.left, 0) / nb / DEV;
  const g = gemCost(sec); if (S.res.gems < g) return toast('Pas assez de cristaux', 'bad');
  S.res.gems -= g; for (const q of S.trainQ) S.army[q.type] = (S.army[q.type] || 0) + 1; S.trainQ = []; saveGame(); refreshUI();
}
function claimDaily() {
  if (!dailyAvailable()) return;
  const d = nextStreakDay(); const r = dailyReward(d);
  const got = { gold: gain('gold', r.gold), sap: gain('sap', r.sap), gems: gain('gems', r.gems) };
  S.daily.streak = d + 1; S.daily.lastDay = dayKey(now());
  toast(`Coffre du jour : +${fmtNum(got.gold)} or, +${fmtNum(got.sap)} sève, +${got.gems} cristaux`, 'good');
  saveGame(); refreshUI();
}
function claimQuest(i) {
  const q = S.quests.list[i]; if (!q || q.claimed || q.prog < q.n) return;
  const r = questReward(q); q.claimed = true;
  gain('gold', r.gold); gain('sap', r.sap); gain('gems', r.gems);
  toast(`Quête accomplie : +${r.gems} cristaux`, 'good'); saveGame(); refreshUI();
}

/* ---------- scène du village ---------- */
function villageScene() {
  const moving = G.place && G.place.moveId;
  const bs = [];
  for (const b of S.buildings) { if (b.id === moving) continue; bs.push(Object.assign({}, b, { fill: fillOf(b) })); }
  return { buildings: bs, ground: villageGround, ghost: placementGhost, overlay: villageOverlay };
}
function footprint(ctx, x, y, s, fill, stroke) {
  poly(ctx, [pt(x, y), pt(x + s, y), pt(x + s, y + s), pt(x, y + s)]);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}
function rangeEllipse(ctx, cx, cy, r, col, fill) {
  const [sx, sy] = pt(cx, cy);
  ctx.beginPath(); ctx.ellipse(sx, sy, r * HW * 1.414, r * HH * 1.414, 0, 0, 7);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.setLineDash([6, 5]); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
}
function visionGrid() {
  const sig = JSON.stringify(S.buildings.map(b => [b.type, b.lvl, b.x, b.y, !!b.upg]));
  if (G.visionCache && G.visionCache.sig === sig) return G.visionCache;
  const an = AI.analyze(AI.layoutFromState());
  let max = 1; for (const v of an.gG) max = Math.max(max, v);
  G.visionCache = { sig, gG: an.gG, gA: an.gA, max, sides: an.sides };
  return G.visionCache;
}
function villageGround(ctx) {
  if (G.vision) {
    const v = visionGrid(), N = MAP_N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = v.gG[y * N + x] / v.max;
      const col = k <= 0.001 ? 'rgba(255,60,80,0.20)' : `rgba(${Math.round(255 * (1 - k))},${Math.round(120 + 135 * k)},${Math.round(140 + 60 * k)},${0.18 + k * 0.25})`;
      footprint(ctx, x, y, 1, col);
    }
    const weakest = v.sides.slice().sort((a, b) => a.ground - b.ground)[0];
    const [ex, ey] = AI.edgeCell(weakest.side, weakest.k);
    const p = pt(ex + 0.5, ey + 0.5); glow(p[0], p[1], 70, '#ff5a64', 1);
  }
  if (G.place) {
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < MAP_N; i++) { let a = pt(i, 1), b = pt(i, MAP_N - 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); a = pt(1, i); b = pt(MAP_N - 1, i); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke();
    const s = BUILDINGS[G.place.type].size, ok = canPlace(G.place.type, G.place.gx, G.place.gy, G.place.moveId);
    footprint(ctx, G.place.gx, G.place.gy, s, ok ? 'rgba(120,255,150,0.35)' : 'rgba(255,90,100,0.4)', ok ? '#9dffb0' : '#ff8a90');
    const a = BUILDINGS[G.place.type].atk;
    if (a) rangeEllipse(ctx, G.place.gx + s / 2, G.place.gy + s / 2, a.range, 'rgba(255,240,200,0.7)', 'rgba(255,240,200,0.06)');
  }
  const sel = G.sel && S.buildings.find(b => b.id === G.sel);
  if (sel) {
    const s = BUILDINGS[sel.type].size;
    footprint(ctx, sel.x, sel.y, s, 'rgba(255,224,138,0.18)', 'rgba(255,224,138,0.9)');
    const a = BUILDINGS[sel.type].atk;
    if (a && sel.lvl >= 1) rangeEllipse(ctx, sel.x + s / 2, sel.y + s / 2, a.range, 'rgba(255,240,200,0.8)', 'rgba(255,240,200,0.07)');
  }
  if (G.hover && !G.place) {
    const x = Math.floor(G.hover.gx), y = Math.floor(G.hover.gy);
    if (x >= 0 && y >= 0 && x < MAP_N && y < MAP_N) footprint(ctx, x, y, 1, 'rgba(255,255,255,0.08)');
  }
}
function placementGhost(ctx) {
  if (!G.place) return;
  ctx.globalAlpha = 0.78;
  drawBuilding(ctx, { type: G.place.type, lvl: 1, x: G.place.gx, y: G.place.gy, fill: 0.4 }, R.t, {});
  ctx.globalAlpha = 1;
}
function villageOverlay(ctx) {
  G.bubbles = [];
  const z = R.cam.z;
  for (const b of S.buildings) {
    if (G.place && G.place.moveId === b.id) continue;
    const d = BUILDINGS[b.type], s = d.size;
    const p = gridToScreen(b.x + s / 2, b.y + s / 2, B_HEIGHT[b.type] + 14);
    if (b.upg) {
      const total = b.upg.total * 1000 / DEV, left = b.upg.end - now(), k = clamp(1 - left / total, 0, 1);
      const w = Math.max(54, 70 * Math.min(1, z * 1.4));
      ctx.fillStyle = 'rgba(14,16,32,0.8)'; roundRect(ctx, p.x - w / 2, p.y - 6, w, 12, 6); ctx.fill();
      ctx.fillStyle = '#6fdc8c'; roundRect(ctx, p.x - w / 2 + 2, p.y - 4, (w - 4) * k, 8, 4); ctx.fill();
      ctx.font = '600 11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,10,20,0.8)';
      const txt = fmtTime(left / 1000); ctx.strokeText(txt, p.x, p.y - 10); ctx.fillText(txt, p.x, p.y - 10);
    } else if (d.prod && b.lvl >= 1) {
      const cap = d.cap(b.lvl);
      if (b.buf >= Math.max(15, cap * 0.08)) {
        const by = p.y - 6 + Math.sin(R.t * 3 + b.id) * 3, full = b.buf >= cap * 0.95;
        const r = 15;
        ctx.fillStyle = full ? 'rgba(255,90,100,0.95)' : 'rgba(255,250,235,0.95)';
        ctx.beginPath(); ctx.arc(p.x, by, r, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(p.x - 5, by + r - 2); ctx.lineTo(p.x, by + r + 6); ctx.lineTo(p.x + 5, by + r - 2); ctx.fill();
        if (d.prod === 'gold') { ctx.fillStyle = '#f0c24f'; ctx.beginPath(); ctx.arc(p.x, by, 8.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#a87a1e'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.strokeStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(p.x, by, 4.5, 0, 7); ctx.stroke(); }
        else { ctx.fillStyle = '#b07cf0'; ctx.beginPath(); ctx.moveTo(p.x, by - 10); ctx.quadraticCurveTo(p.x + 9, by + 1, p.x, by + 8); ctx.quadraticCurveTo(p.x - 9, by + 1, p.x, by - 10); ctx.fill(); }
        G.bubbles.push({ x: p.x, y: by, r: r + 6, id: b.id });
      }
    }
  }
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function villageClick(gx, gy, sx, sy) {
  if (G.place) { placeAt(gx, gy); refreshUI(); return; }
  for (const bb of G.bubbles) if (Math.hypot(sx - bb.x, sy - bb.y) <= bb.r) { const b = S.buildings.find(x => x.id === bb.id); collect(b); saveGame(); refreshUI(); return; }
  const b = bAtState(Math.floor(gx), Math.floor(gy));
  if (b) { G.sel = b.id; if (BUILDINGS[b.type].prod && b.buf >= 1) collect(b, true); }
  else G.sel = null;
  refreshUI();
}

/* ---------- défense (tower defense) ---------- */
function battleLayoutFromState() { return S.buildings.filter(b => b.lvl >= 1).map(b => ({ type: b.type, lvl: b.lvl, x: b.x, y: b.y, upg: b.upg })); }
function getPendingPlan() {
  if (!S.ai.pending || S.ai.pending.T !== S.threat) { S.ai.pending = AI.plan(); saveGame(); }
  return S.ai.pending;
}
function startDefense() {
  if (S.horns.n <= 0) return toast('Aucune corne de guerre disponible', 'bad');
  const plan = getPendingPlan(); useHorn(); S.ai.pending = null;
  const B = new Battle('defense', battleLayoutFromState());
  G.battle = B; G.plan = plan; G.mode = 'defense'; G.spell = null; G.speed = 1; G.sel = null; G.place = null;
  G.charges = { bolt: SPELLS.bolt.charges, frost: CL() >= SPELLS.frost.cl ? SPELLS.frost.charges : 0 };
  B.wave = -1; B.queue = []; B.pause = null;
  B.onUpdate = () => defenseUpdate(B);
  B.onEnd = win => setTimeout(() => endDefense(win), 1300);
  SFX.play('horn'); closeModal(); saveGame(); enterBattleUI(); nextWave(B);
}
function nextWave(B) {
  B.wave++;
  B.queue = G.plan.waves[B.wave].map((u, i) => Object.assign({}, u, { at: B.t + 1.5 + i * 0.5 }));
  B.waveStart = B.t;
  const champ = B.queue.some(q => q.elite);
  banner(`Vague ${B.wave + 1} / 3`, champ ? 'Le Champion du Seigneur des Cendres approche !' : `Ils arrivent par le flanc ${SIDE_NAMES[B.queue[0] ? B.queue[0].side : 0]}`);
}
function defenseUpdate(B) {
  while (B.queue.length && B.queue[0].at <= B.t) {
    const q = B.queue.shift(); const air = !!UNITS[q.type].air;
    const [x, y] = AI.spawnPos(q.side, q.k, air);
    B.spawn(q.type, G.plan.lvl + (q.elite ? 1 : 0), 'enemy', x, y, q.elite);
  }
  if (B.queue.length) return;
  const alive = B.units.length;
  if (B.wave < 2) {
    if (!alive || B.t - B.waveStart > 45) {
      if (B.pause == null) B.pause = B.t + (alive ? 0 : 2.5);
      if (B.t >= B.pause) { B.pause = null; nextWave(B); }
    }
  } else if (!alive) B.end(true);
}
function castSpell(gx, gy) {
  const B = G.battle; if (!B || B.over || !G.spell || !(G.charges[G.spell] > 0)) return false;
  const sp = SPELLS[G.spell];
  if (G.spell === 'bolt') {
    const dmg = sp.dmg(CL());
    for (const u of B.units) if (Math.hypot(u.x - gx, u.y - gy) <= sp.radius) B.hitUnit(u, dmg, true);
    SFX.play('bolt'); Particles.bolt(gx, gy); Particles.ring(gx, gy, sp.radius, '#dff1ff', 0.5); Particles.burst(gx, gy, 4, '#eaf6ff', 26, 2.5);
  } else {
    for (const u of B.units) if (Math.hypot(u.x - gx, u.y - gy) <= sp.radius) { u.frozenT = sp.freeze; Particles.sparkle(u.x, u.y, 12, '#dff6ff'); }
    SFX.play('freeze'); Particles.ring(gx, gy, sp.radius, '#9fe3ff', 0.8); Particles.burst(gx, gy, 6, '#bfe9ff', 30, 2);
  }
  G.charges[G.spell]--; track('spell', 1);
  if (G.charges[G.spell] <= 0) G.spell = null;
  updateBattleUI(true);
  return true;
}
function endDefense(win) {
  const B = G.battle, T = S.threat;
  const cr = B.cit.hp / B.cit.maxHp;
  const stars = win ? (cr >= 0.9 ? 3 : cr >= 0.5 ? 2 : 1) : 0;
  const r = { gold: Math.round(B.loot.gold), sap: Math.round(B.loot.sap), gems: 0 };
  let lost = null, renown = 0;
  if (win) {
    r.gold += 200 + 150 * T; r.sap += 200 + 150 * T; r.gems = 1 + (stars === 3 ? 2 : 0);
    S.threat++; renown = 8 + T * 2 + stars * 2; S.stats.defWin++; track('defWin', 1);
  } else {
    r.gold = Math.round(r.gold * 0.5); r.sap = Math.round(r.sap * 0.5);
    lost = { gold: Math.floor(S.res.gold * 0.1), sap: Math.floor(S.res.sap * 0.1) };
    S.res.gold -= lost.gold; S.res.sap -= lost.sap;
    S.threat = Math.max(1, T - 1); renown = -Math.min(S.renown, 6); S.stats.defLoss++;
  }
  S.renown += renown; S.stats.kills += B.kills; track('kill', B.kills);
  const got = { gold: gain('gold', r.gold), sap: gain('sap', r.sap), gems: gain('gems', r.gems) };
  AI.learn(G.plan, B, !win);
  const quote = AI.battleComment(B, !win);
  saveGame();
  showEndModal({ kind: 'defense', win, stars, got, lost, renown, quote, kills: B.kills, T });
}

/* ---------- expéditions (attaque) ---------- */
function expeUnlocked() { let m = 1; for (const k in S.expe.stars) if (S.expe.stars[k] > 0) m = Math.max(m, +k + 1); return m; }
function armyTotal() { let n = 0; for (const k in S.army) n += S.army[k] || 0; return n; }
function startExpedition(n) {
  if (n > expeUnlocked()) return;
  if (!armyTotal()) return toast("Vous n'avez aucune troupe : entraînez-en à la caserne", 'bad');
  const camp = AI.camp(n);
  const B = new Battle('attack', camp.layout, { hpMul: n <= 3 ? 0.6 : n <= 8 ? 0.8 : 1 });
  G.battle = B; G.camp = camp; G.mode = 'attack'; G.speed = 1; G.sel = null; G.place = null; G.spell = null;
  G.left = Object.assign({}, S.army); G.deployed = {};
  G.deploySel = UNIT_ORDER.find(k => G.left[k] > 0);
  B.started = false; B.zone = null;
  B.onDestroy = () => { B.zone = null; };
  B.onUpdate = () => {
    if (B.t >= BATTLE_TIME) B.end(false);
    else if (B.started && !B.units.length && !UNIT_ORDER.some(k => G.left[k] > 0)) B.end(false);
  };
  B.onEnd = () => setTimeout(endAttack, 1100);
  closeModal(); enterBattleUI();
  banner(camp.name, `Camp ${n} · conçu ${camp.style} par l'Architecte — déployez vos troupes hors de la zone rouge`);
}
function deployZone(B) {
  if (B.zone) return B.zone;
  const N = MAP_N, z = new Uint8Array(N * N).fill(1);
  for (const e of B.buildings) { if (e.dead) continue; for (let y = e.y - 1; y <= e.y + e.size; y++) for (let x = e.x - 1; x <= e.x + e.size; x++) if (x >= 0 && y >= 0 && x < N && y < N) z[y * N + x] = 0; }
  B.zone = z; return z;
}
function deployAt(gx, gy) {
  const B = G.battle; if (!B || B.over || G.mode !== 'attack') return false;
  const type = G.deploySel; if (!type || !(G.left[type] > 0)) return false;
  const x = Math.floor(gx), y = Math.floor(gy);
  if (x < 0 || y < 0 || x >= MAP_N || y >= MAP_N || !deployZone(B)[y * MAP_N + x]) return false;
  B.spawn(type, troopLevel(), 'player', gx, gy);
  G.left[type]--; G.deployed[type] = (G.deployed[type] || 0) + 1; B.started = true;
  Particles.ring(gx, gy, 0.5, 'rgba(120,190,255,0.8)', 0.35);
  if (G.left[type] <= 0) G.deploySel = UNIT_ORDER.find(k => G.left[k] > 0) || null;
  updateBattleUI(true);
  return true;
}
function deployTick(dt) {
  const h = G.deployHold; if (!h) return;
  h.acc += dt;
  while (h.acc >= 0.12) { h.acc -= 0.12; const g = screenToGrid(h.sx, h.sy); if (!deployAt(g.gx, g.gy)) { h.acc = 0; break; } }
}
function endAttack() {
  const B = G.battle, camp = G.camp;
  const pct = B.destructionPct();
  let stars = 0; if (pct >= 0.5) stars++; if (B.cit.dead) stars++; if (pct >= 0.999) stars++;
  const prev = S.expe.stars[camp.n] || 0, newStars = Math.max(0, stars - prev);
  const mult = prev > 0 ? 0.5 : 1;
  const got = { gold: gain('gold', B.loot.gold * mult), sap: gain('sap', B.loot.sap * mult), gems: gain('gems', newStars * 3) };
  S.expe.stars[camp.n] = Math.max(prev, stars);
  for (const k in G.deployed) S.army[k] = Math.max(0, (S.army[k] || 0) - G.deployed[k]);
  if (stars > 0) { S.stats.expeWin++; track('stars', stars); }
  const renown = stars * 3; S.renown += renown;
  saveGame();
  showEndModal({ kind: 'attack', win: stars > 0, stars, got, pct, renown, camp, newStars, replay: prev > 0 });
}
function exitBattle() {
  G.battle = null; G.mode = 'village'; G.spell = null; G.deployHold = null; G.speed = 1;
  exitBattleUI(); refreshUI();
}
function retreat() {
  const B = G.battle; if (!B || B.over) return;
  if (G.mode === 'attack') B.end(false);
  else { B.cit.hp = 0; B.destroy(B.cit); }
}

/* ---------- scène de combat ---------- */
function battleScene() {
  const B = G.battle;
  return { buildings: B.buildings, units: B.units, projs: B.projs, night: G.mode === 'defense', ground: battleGround, overlay: battleOverlay };
}
function battleGround(ctx) {
  const B = G.battle;
  for (const e of B.buildings) if (!e.dead && e.atk && e.atk.aura && !e.disabled) {
    rangeEllipse(ctx, e.cx, e.cy, e.atk.range, 'rgba(170,225,255,0.35)', `rgba(140,210,255,${0.07 + Math.sin(R.t * 3) * 0.03})`);
  }
  if (G.mode === 'attack' && UNIT_ORDER.some(k => G.left[k] > 0)) {
    const z = deployZone(B), N = MAP_N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!z[y * N + x]) footprint(ctx, x, y, 1, 'rgba(255,70,80,0.13)');
  }
  if (G.spell && G.hover) {
    const sp = SPELLS[G.spell];
    rangeEllipse(ctx, G.hover.gx, G.hover.gy, sp.radius, G.spell === 'bolt' ? 'rgba(220,240,255,0.9)' : 'rgba(150,225,255,0.9)', 'rgba(200,235,255,0.12)');
  }
}
function battleOverlay(ctx) {
  const B = G.battle;
  for (const e of B.buildings) {
    if (e.dead || e.hp >= e.maxHp) continue;
    const p = gridToScreen(e.cx, e.cy, B_HEIGHT[e.type] + 8);
    hpBar(ctx, p.x, p.y, e.type === 'wall' ? 22 : 46, e.hp / e.maxHp, e.type === 'citadel' ? '#ffd34d' : '#7fe08a');
  }
}
function battleClick(gx, gy) {
  if (G.mode === 'defense') { if (G.spell) castSpell(gx, gy); else toast('Choisissez un sort en bas de l\'écran pour frapper les ennemis'); }
}
