'use strict';
/* ==========================================================================
   État persistant, économie en temps réel, progression hors-ligne
   ========================================================================== */
const SAVE_KEY = 'ambrevale_save_v1';
let S = null;
const now = () => Date.now();

function newState() {
  const t = now();
  return {
    v: 1, created: t, last: t, tick: t,
    res: { gold: 900, sap: 900, gems: 50 },
    threat: 1, renown: 0, builders: 2, nextId: 1,
    buildings: [],
    army: {}, trainQ: [],
    horns: { n: HORN_MAX, t: t },
    daily: { lastDay: '', streak: 0 },
    quests: { day: '', list: [] },
    expe: { stars: {} },
    ai: { w: { marauder: 1, scout: 1, archerU: 1, sapper: 1, brute: 1, shaman: 1, wyvern: 1 }, history: [], pending: null },
    stats: { defWin: 0, defLoss: 0, kills: 0, expeWin: 0 },
    seenIntro: false
  };
}

function addBuilding(type, x, y, lvl) {
  const b = { id: S.nextId++, type, lvl, x, y, upg: null, buf: 0 };
  S.buildings.push(b);
  return b;
}

function seedStart() {
  addBuilding('citadel', 11, 11, 1);
  addBuilding('goldmine', 7, 11, 1);
  addBuilding('sapwell', 12, 16, 1);
  addBuilding('archer', 9, 8, 1);
  addBuilding('barracks', 16, 14, 1);
  addBuilding('camp', 16, 17, 1);
  S.army = { marauder: 10 };
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      S = Object.assign(newState(), JSON.parse(raw));
      S.ai = Object.assign(newState().ai, S.ai || {});
      return true;
    }
  } catch (e) { console.warn(e); }
  S = newState(); seedStart();
  return false;
}
let RESETTING = false;
function saveGame() { if (RESETTING) return; try { S.last = now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function resetGame() { RESETTING = true; localStorage.removeItem(SAVE_KEY); location.reload(); }

/* ---------- requêtes ---------- */
function citadel() { return S.buildings.find(b => b.type === 'citadel'); }
function CL() { return Math.max(1, citadel().lvl); }
function countType(t) { return S.buildings.filter(b => b.type === t).length; }
function limitOf(t) { return LIMITS[t][Math.min(8, CL())]; }
function maxLvlOf(t) { if (t === 'citadel') return BUILDINGS.citadel.maxLvl; return Math.min(BUILDINGS[t].maxLvl, CL() + 1); }
function capacity(res) {
  let c = 0;
  for (const b of S.buildings) {
    if (b.lvl < 1) continue;
    if (b.type === 'citadel') c += BUILDINGS.citadel.store(b.lvl);
    if (res === 'gold' && b.type === 'goldvault') c += BUILDINGS.goldvault.storeGold(b.lvl);
    if (res === 'sap' && b.type === 'sapvault') c += BUILDINGS.sapvault.storeSap(b.lvl);
  }
  return c;
}
function housingCap() { let c = 0; for (const b of S.buildings) if (b.type === 'camp' && b.lvl >= 1) c += BUILDINGS.camp.housing(b.lvl); return c; }
function housingArmy() { let h = 0; for (const k in S.army) h += (S.army[k] || 0) * UNITS[k].housing; return h; }
function housingUsed() { let h = housingArmy(); for (const q of S.trainQ) h += UNITS[q.type].housing; return h; }
function buildersBusy() { return S.buildings.filter(b => b.upg && !BUILDINGS[b.type].instant).length; }
function barracksLvl() { let m = 0; for (const b of S.buildings) if (b.type === 'barracks') m = Math.max(m, b.lvl); return m; }
function troopLevel() { return Math.max(1, Math.ceil(barracksLvl() / 2)); }
function buildCost(type, lvl) { const d = BUILDINGS[type]; return { [d.costRes]: d.cost(lvl) }; }
function buildTime(type, lvl) { const d = BUILDINGS[type]; if (d.instant) return 0; return TIME_TABLE[lvl] * d.tf; }
function canAfford(cost) { for (const k in cost) if ((S.res[k] || 0) < cost[k]) return false; return true; }
function spend(cost) { for (const k in cost) S.res[k] -= cost[k]; }
function gain(res, amount) {
  if (res === 'gems') { S.res.gems += Math.floor(amount); return Math.floor(amount); }
  const cap = capacity(res);
  const add = Math.max(0, Math.min(Math.floor(amount), cap - S.res[res]));
  S.res[res] += add;
  return add;
}
function hornNextIn() { if (S.horns.n >= HORN_MAX) return 0; return Math.max(0, HORN_REGEN - (now() - S.horns.t) / 1000 * DEV) / DEV; }
function useHorn() { if (S.horns.n <= 0) return false; if (S.horns.n >= HORN_MAX) S.horns.t = now(); S.horns.n--; return true; }

/* ---------- économie en temps réel ---------- */
function tickEconomy() {
  const t = now();
  const dt = (t - (S.tick || t)) / 1000;
  S.tick = t;
  const ev = { upgrades: [], trained: 0, horns: 0, produced: { gold: 0, sap: 0 } };
  if (dt <= 0) return ev;
  // production (avant la fin des améliorations, approximation suffisante)
  for (const b of S.buildings) {
    const d = BUILDINGS[b.type];
    if (d.prod && b.lvl >= 1 && !b.upg) {
      const before = b.buf;
      b.buf = Math.min(d.cap(b.lvl), b.buf + d.rate(b.lvl) / 3600 * dt * DEV);
      ev.produced[d.prod] += b.buf - before;
    }
  }
  for (const b of S.buildings) {
    if (b.upg && t >= b.upg.end) { b.lvl++; b.upg = null; ev.upgrades.push(b); }
  }
  // entraînement
  const nb = S.buildings.filter(b => b.type === 'barracks' && b.lvl >= 1 && !b.upg).length;
  let tt = dt * DEV * nb;
  while (tt > 0 && S.trainQ.length) {
    const q = S.trainQ[0];
    if (q.left > tt) { q.left -= tt; tt = 0; }
    else { tt -= q.left; S.trainQ.shift(); S.army[q.type] = (S.army[q.type] || 0) + 1; ev.trained++; }
  }
  // cornes de guerre
  if (S.horns.n < HORN_MAX) {
    const el = (t - S.horns.t) / 1000 * DEV;
    const g = Math.floor(el / HORN_REGEN);
    if (g > 0) {
      const add = Math.min(g, HORN_MAX - S.horns.n);
      S.horns.n += add; ev.horns += add;
      S.horns.t += g * HORN_REGEN * 1000 / DEV;
      if (S.horns.n >= HORN_MAX) S.horns.t = t;
    }
  } else S.horns.t = t;
  ensureQuests();
  return ev;
}

/* ---------- quêtes et coffre quotidien ---------- */
function ensureQuests() {
  const day = dayKey(now());
  if (S.quests.day === day) return;
  const rng = mulberry32(hashStr(day + ':' + S.created));
  const ids = Object.keys(QUESTS);
  const picked = [];
  while (picked.length < 3) { const id = ids[Math.floor(rng() * ids.length)]; if (!picked.includes(id)) picked.push(id); }
  S.quests = { day, list: picked.map(id => ({ id, n: QUESTS[id].n(CL()), prog: 0, claimed: false })) };
}
function track(key, amt) {
  ensureQuests();
  for (const q of S.quests.list) if (QUESTS[q.id].track === key && !q.claimed) q.prog = Math.min(q.n, q.prog + amt);
}
function questReward(q) { return { gems: QUESTS[q.id].gems, gold: 250 * CL(), sap: 250 * CL() }; }
function dailyAvailable() { return S.daily.lastDay !== dayKey(now()); }
function dailyReward(streakDay) {
  const m = 1 + streakDay * 0.2;
  return { gold: Math.round(500 * CL() * m), sap: Math.round(500 * CL() * m), gems: DAILY_GEMS[streakDay % 7] };
}
function nextStreakDay() {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return S.daily.lastDay === dayKey(y.getTime()) ? (S.daily.streak % 7) : 0;
}
