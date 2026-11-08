'use strict';
/* ==========================================================================
   Démarrage, boucle principale, entrées (souris / tactile)
   ========================================================================== */
function tickEconomyUI() {
  const ev = tickEconomy();
  for (const b of ev.upgrades) {
    SFX.play('build');
    toast(`🔨 ${BUILDINGS[b.type].name} ${b.lvl === 1 ? 'construit' : 'amélioré au niveau ' + b.lvl} !`, 'good');
    const s = BUILDINGS[b.type].size; Particles.burst(b.x + s / 2, b.y + s / 2, 30, '#ffe08a', 30, 2);
    G.visionCache = null;
  }
  if (ev.trained && UI_OPEN === 'army' && !$('#modal').classList.contains('hidden')) openArmy();
  if (ev.horns) toast('📯 Une corne de guerre est prête', 'good');
  if (ev.upgrades.length || ev.trained) { saveGame(); refreshUI(); }
  return ev;
}

function boot() {
  const had = loadGame();
  initRender(); initUI();
  // progression hors-ligne
  const away = (now() - (S.tick || now())) / 1000;
  const bufBefore = { gold: 0, sap: 0 };
  for (const b of S.buildings) { const d = BUILDINGS[b.type]; if (d.prod) bufBefore[d.prod] += b.buf; }
  const ev = tickEconomy();
  const bufAfter = { gold: 0, sap: 0 };
  for (const b of S.buildings) { const d = BUILDINGS[b.type]; if (d.prod) bufAfter[d.prod] += b.buf; }
  ensureQuests(); saveGame(); refreshUI();
  if (!had || !S.seenIntro) showIntro();
  else if (away > 90) showWelcome(away, ev, bufAfter.gold - bufBefore.gold, bufAfter.sap - bufBefore.sap);
  setInterval(tickEconomyUI, 1000);
  setInterval(() => { updateLive(); if (G.mode === 'village') updateTopbar(); else updateBattleUI(false); }, 250);
  setInterval(() => { if (G.mode === 'village') saveGame(); }, 10000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); else tickEconomyUI(); });
  window.addEventListener('beforeunload', saveGame);
  initInput();
  requestAnimationFrame(frame);
}

let _last = performance.now();
function frame(ts) {
  const dt = clamp((ts - _last) / 1000, 0, 0.05); _last = ts;
  requestAnimationFrame(frame);
  try {
    const B = G.battle;
    if (B && !B.over) {
      let rem = dt * G.speed;
      while (rem > 1e-6) { const st = Math.min(rem, 1 / 40); B.update(st); rem -= st; }
      if (G.mode === 'attack') deployTick(dt);
    }
    Particles.update(dt * (B ? G.speed : 1));
    drawScene(B ? battleScene() : villageScene(), dt);
  } catch (e) { console.error(e); }
}

/* ---------- entrées ---------- */
function initInput() {
  const cv = R.canvas, ptrs = new Map();
  let drag = null, pinch = null;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: R.cam.z }; drag = null; G.deployHold = null; return;
    }
    drag = { sx: e.clientX, sy: e.clientY, cx: R.cam.x, cy: R.cam.y, moved: false, deploy: false };
    if (G.mode === 'attack' && G.battle && !G.battle.over) {
      const g = screenToGrid(e.clientX, e.clientY);
      if (deployAt(g.gx, g.gy)) { drag.deploy = true; G.deployHold = { sx: e.clientX, sy: e.clientY, acc: -0.18 }; }
    }
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') G.hover = screenToGrid(e.clientX, e.clientY);
    if (G.place && e.pointerType === 'mouse' && !drag) {
      const s = BUILDINGS[G.place.type].size; G.place.gx = Math.round(G.hover.gx - s / 2); G.place.gy = Math.round(G.hover.gy - s / 2);
    }
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      R.cam.z = clamp(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, 0.2, 2.5); return;
    }
    if (!drag) return;
    if (drag.deploy) { G.deployHold.sx = e.clientX; G.deployHold.sy = e.clientY; return; }
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 7) drag.moved = true;
    if (drag.moved) {
      R.cam.x = drag.cx - dx / R.cam.z; R.cam.y = drag.cy - dy / R.cam.z;
      clampCam();
    }
  });
  const up = e => {
    const wasPinch = !!pinch;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!drag) return;
    const d = drag; drag = null; G.deployHold = null;
    if (wasPinch || d.moved || d.deploy || e.type === 'pointercancel') return;
    const g = screenToGrid(e.clientX, e.clientY);
    if (G.mode === 'village') villageClick(g.gx, g.gy, e.clientX, e.clientY);
    else battleClick(g.gx, g.gy);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') G.hover = null; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const before = screenToGrid(e.clientX, e.clientY);
    R.cam.z = clamp(R.cam.z * Math.exp(-e.deltaY * 0.0015), 0.2, 2.5);
    const after = screenToGrid(e.clientX, e.clientY);
    R.cam.x += isoX(before.gx, before.gy) - isoX(after.gx, after.gy);
    R.cam.y += isoY(before.gx, before.gy) - isoY(after.gx, after.gy);
    clampCam();
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('#modal').classList.contains('hidden') && !$('#modal').dataset.locked) closeModal(); else if (G.place) G.place = null; else G.sel = null; G.spell = null; refreshUI(); }
    if (G.mode === 'village' && G.place && e.key === 'Enter') confirmPlace();
    if (G.mode === 'defense' && (e.key === '1' || e.key === '2')) ACT.spell(e.key === '1' ? 'bolt' : 'frost');
  });
}
function clampCam() {
  const lim = MAP_N * HW * 1.1;
  R.cam.x = clamp(R.cam.x, -lim, lim);
  R.cam.y = clamp(R.cam.y, -MAP_N * HH * 0.2, MAP_N * TH * 1.1);
}

window.addEventListener('load', boot);
