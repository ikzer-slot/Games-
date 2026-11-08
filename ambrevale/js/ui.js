'use strict';
/* ==========================================================================
   Interface (HTML par-dessus le canvas)
   ========================================================================== */
const $ = s => document.querySelector(s);
const svg = inner => `<svg class="i" viewBox="0 0 24 24">${inner}</svg>`;
const ICON = {
  gold: svg('<circle cx="12" cy="12" r="9.5" fill="#f0c24f" stroke="#a87a1e" stroke-width="1.6"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#fff3c4" stroke-width="1.6"/>'),
  sap: svg('<path d="M12 2.5C9 7 5.2 10.4 5.2 14.6a6.8 6.8 0 0 0 13.6 0C18.8 10.4 15 7 12 2.5z" fill="#b07cf0" stroke="#6a3cb0" stroke-width="1.6"/><path d="M8.8 14.5a3.2 3.2 0 0 0 3.2 3.2" stroke="#f0e2ff" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  gems: svg('<path d="M6.5 3.5h11l4 5.5L12 20.5 2.5 9z" fill="#5fe0d0" stroke="#2a8f86" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.5 9h19M9 3.5L12 20.5 15 3.5" stroke="#d5fff9" stroke-width="1" fill="none"/>'),
  builder: svg('<path d="M14 3l7 7-2 2-2.5-2.5L8 18l-2-2 8.5-8.5L12 5z" fill="#e9d8b4" stroke="#7a5638" stroke-width="1.4" stroke-linejoin="round"/><path d="M3.5 20.5l4-4" stroke="#7a5638" stroke-width="2.4" stroke-linecap="round"/>'),
  horn: svg('<path d="M3 14c4 0 9-3 12-8l3 1c-1 6-5 11-12 11H4z" fill="#f0c24f" stroke="#8a5f17" stroke-width="1.4" stroke-linejoin="round"/><path d="M15 6l3 1 2-3" stroke="#8a5f17" stroke-width="1.4" fill="none"/>'),
  build: svg('<path d="M4 21V9h3v2h2V9h2v2h2V9h2v2h2V9h3v12z" fill="#e8dcc2" stroke="#6b5a40" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 21v-5a2 2 0 0 1 4 0v5" fill="#5a3e2b"/><path d="M12 8V3l4 1.5-4 1.5" stroke="#c0584f" stroke-width="1.4" fill="#c0584f"/>'),
  army: svg('<path d="M5 19L17 5M17 5h2v2M19 19L7 5M7 5H5v2" stroke="#e9e9f2" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 17l3 3M20 17l-3 3" stroke="#d09a5e" stroke-width="2.6" stroke-linecap="round"/>'),
  shield: svg('<path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z" fill="#4f6fb3" stroke="#ffe08a" stroke-width="1.5"/><path d="M12 6v12M7 10h10" stroke="#ffe08a" stroke-width="1.5"/>'),
  map: svg('<circle cx="12" cy="12" r="9" fill="#e9dcc0" stroke="#8a6a3c" stroke-width="1.5"/><path d="M12 4.5l2.6 7.5L12 19.5 9.4 12z" fill="#c0584f"/><path d="M14.6 12L12 19.5 9.4 12z" fill="#4f6fb3"/><circle cx="12" cy="12" r="1.3" fill="#fff"/>'),
  scroll: svg('<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" fill="#efe2c2" stroke="#8a6a3c" stroke-width="1.4"/><path d="M9 9h7M9 12h7M9 15h5" stroke="#8a6a3c" stroke-width="1.3"/>'),
  eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="#2b3566" stroke="#5fe0d0" stroke-width="1.5"/><circle cx="12" cy="12" r="3.6" fill="#5fe0d0"/><circle cx="13" cy="11" r="1.2" fill="#fff"/>'),
  gear: svg('<circle cx="12" cy="12" r="3.2" fill="none" stroke="#d8d2c4" stroke-width="1.8"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M5.2 18.8l2.1-2.1M16.7 7.3l2.1-2.1" stroke="#d8d2c4" stroke-width="1.8" stroke-linecap="round"/>'),
  star: svg('<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z" fill="#ffd34d" stroke="#a87a1e" stroke-width="1.2" stroke-linejoin="round"/>'),
  starOff: svg('<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.3)" stroke-width="1.2" stroke-linejoin="round"/>'),
  crown: svg('<path d="M3 18l1.5-10 5 4.5L12 5l2.5 7.5 5-4.5L21 18z" fill="#f0c24f" stroke="#8a5f17" stroke-width="1.3" stroke-linejoin="round"/><rect x="3" y="18" width="18" height="2.5" rx="1" fill="#c48e2a"/>'),
  flame: svg('<path d="M12 2.5c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3-.5-3 0-6 .5-8.5z" fill="#ff7a4a" stroke="#a83a1a" stroke-width="1.3" stroke-linejoin="round"/>'),
  chest: svg('<rect x="3" y="9" width="18" height="11" rx="1.5" fill="#9a6a3d" stroke="#5a3e1f" stroke-width="1.3"/><path d="M3 9a9 5 0 0 1 18 0" fill="#b57c46" stroke="#5a3e1f" stroke-width="1.3"/><rect x="10.5" y="11" width="3" height="4" fill="#f0c24f"/><path d="M3 13h18" stroke="#f0c24f" stroke-width="1.3"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5" fill="none" stroke="#d8d2c4" stroke-width="1.6"/><path d="M12 7v5l3 2" stroke="#d8d2c4" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  house: svg('<path d="M3 11l9-7 9 7v9H3z" fill="#e7d7b0" stroke="#6b5a40" stroke-width="1.3" stroke-linejoin="round"/><rect x="10" y="14" width="4" height="6" fill="#6b4a30"/>')
};
const ic = (n, small) => small ? ICON[n].replace('class="i"', 'class="i s"') : ICON[n];
const RES_NAME = { gold: 'or', sap: 'sève', gems: 'cristaux' };
function costHtml(cost) { return Object.entries(cost).map(([k, v]) => `<span class="cost ${(S.res[k] || 0) >= v ? '' : 'no'}">${ic(k, 1)}${fmtNum(v)}</span>`).join(' '); }
function starsHtml(n) { let h = '<span class="stars">'; for (let i = 0; i < 3; i++) h += i < n ? ICON.star : ICON.starOff; return h + '</span>'; }

/* ---------- initialisation ---------- */
function initUI() {
  $('#topbar').innerHTML = `
    <div class="pill gold res"><span class="ico">${ICON.gold}</span><div class="rv"><b id="r-gold"></b><div class="bar"><i id="b-gold"></i></div><small id="c-gold"></small></div></div>
    <div class="pill sap res"><span class="ico">${ICON.sap}</span><div class="rv"><b id="r-sap"></b><div class="bar"><i id="b-sap"></i></div><small id="c-sap"></small></div></div>
    <div class="pill gem small" data-act="oracleShop"><span class="ico">${ICON.gems}</span><div class="rv"><b id="r-gems"></b></div></div>
    <div class="spacer"></div>
    <div class="pill small" title="Bâtisseurs" data-act="builders"><span class="ico">${ICON.builder}</span><div class="rv"><b id="r-build"></b></div></div>
    <div class="pill small" title="Renommée et menace"><span class="ico">${ICON.crown}</span><div class="rv"><b id="r-renown"></b><small id="r-threat"></small></div></div>`;
  $('#bottombar').innerHTML = `
    <button class="nb" data-act="shop"><span class="ic">${ICON.build}</span>Bâtir</button>
    <button class="nb" data-act="army"><span class="ic">${ICON.army}</span>Armée<span class="badge g hidden" id="bd-army"></span></button>
    <button class="nb hl" data-act="raid"><span class="ic">${ICON.shield}</span>Défendre<span class="badge" id="bd-horn"></span></button>
    <button class="nb" data-act="expe"><span class="ic">${ICON.map}</span>Expédition</button>
    <button class="nb" data-act="quests"><span class="ic">${ICON.scroll}</span>Quêtes<span class="badge hidden" id="bd-quest"></span></button>
    <button class="nb" data-act="oracle"><span class="ic">${ICON.eye}</span>Oracle</button>
    <button class="nb" data-act="settings"><span class="ic">${ICON.gear}</span>Options</button>`;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset.arg, el); }
  });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal').dataset.locked) closeModal(); });
  updateTopbar();
}
function selB() { return G.sel && S.buildings.find(b => b.id === G.sel); }

const ACT = {
  shop: () => openShop(), army: () => openArmy(), raid: () => openRaid(), expe: () => openExpe(), quests: () => openQuests(),
  oracle: () => openOracle(), settings: () => openSettings(), close: () => closeModal(), builders: () => openBuilders(), oracleShop: () => openBuilders(),
  tab: a => { UI_TAB = a; openShop(); },
  buy: a => startBuild(a),
  upgrade: () => { const b = selB(); if (b) upgradeBuilding(b); },
  speed: () => { const b = selB(); if (b) speedUp(b); },
  cancel: () => { const b = selB(); if (b) cancelUpgrade(b); },
  move: () => { const b = selB(); if (b) startMove(b); },
  collect: () => { const b = selB(); if (b) { collect(b); saveGame(); refreshUI(); } },
  collectAll: () => collectAll(),
  walls: a => upgradeAllWalls(+a),
  remove: () => { const b = selB(); if (b) removeBuilding(b); },
  deselect: () => { G.sel = null; refreshUI(); },
  placeOk: () => confirmPlace(),
  placeNo: () => { G.place = null; refreshUI(); },
  train: a => { const [t, n] = a.split(':'); trainUnit(t, +n); openArmy(); },
  untrain: a => { untrain(+a); openArmy(); },
  finishTrain: () => { finishTraining(); openArmy(); },
  defend: () => startDefense(),
  camp: a => { UI_CAMP = +a; openExpe(); },
  attack: a => startExpedition(+a),
  daily: () => { claimDaily(); openQuests(); },
  claim: a => { claimQuest(+a); openQuests(); },
  vision: () => { G.vision = !G.vision; openOracle(); },
  buyBuilder: () => { buyBuilder(); openBuilders(); },
  reset: () => { if (confirm('Effacer toute votre progression ?')) resetGame(); },
  spell: a => { G.spell = G.spell === a ? null : a; updateBattleUI(true); },
  troop: a => { G.deploySel = a; updateBattleUI(true); },
  speedx: () => { G.speed = G.speed === 1 ? 2 : 1; updateBattleUI(true); },
  retreat: () => retreat(),
  endOk: () => { $('#modal').dataset.locked = ''; closeModal(); exitBattle(); },
  intro: () => { S.seenIntro = true; saveGame(); closeModal(); }
};

/* ---------- barre du haut ---------- */
function updateTopbar() {
  for (const r of ['gold', 'sap']) {
    const cap = capacity(r);
    $('#r-' + r).textContent = fmtNum(S.res[r]);
    $('#b-' + r).style.width = clamp(S.res[r] / cap * 100, 0, 100) + '%';
    $('#c-' + r).textContent = 'max ' + fmtNum(cap);
    $('#r-' + r).closest('.pill').classList.toggle('full', S.res[r] >= cap);
  }
  $('#r-gems').textContent = fmtNum(S.res.gems);
  $('#r-build').textContent = (S.builders - buildersBusy()) + '/' + S.builders;
  $('#r-renown').textContent = fmtNum(S.renown);
  $('#r-threat').textContent = 'Menace ' + S.threat;
  const bh = $('#bd-horn'); bh.textContent = S.horns.n; bh.classList.toggle('g', S.horns.n > 0); bh.classList.toggle('hidden', false);
  const q = S.quests.list.filter(q => q.prog >= q.n && !q.claimed).length + (dailyAvailable() ? 1 : 0);
  $('#bd-quest').textContent = q; $('#bd-quest').classList.toggle('hidden', !q);
  const ba = $('#bd-army'); const ta = armyTotal(); ba.textContent = ta; ba.classList.toggle('hidden', !ta);
}
function refreshUI() {
  updateTopbar(); renderPanel(); renderPlacebar();
}
function toast(msg, kind) {
  const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.innerHTML = msg;
  $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = 0; setTimeout(() => el.remove(), 400); }, 2600);
}
let _bannerT = 0;
function banner(title, sub) {
  const b = $('#banner'); b.innerHTML = `<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}`; b.classList.add('show');
  clearTimeout(_bannerT); _bannerT = setTimeout(() => b.classList.remove('show'), 2400);
}
function openModal(html, locked) {
  const m = $('#modal'); m.classList.remove('hidden'); m.dataset.locked = locked ? '1' : '';
  m.querySelector('.modal-card').innerHTML = (locked ? '' : '<button class="x" data-act="close">×</button>') + html;
}
function closeModal() { $('#modal').classList.add('hidden'); UI_OPEN = null; }
let UI_OPEN = null, UI_TAB = 'defense', UI_CAMP = null;

/* ---------- minuteurs dynamiques ---------- */
function updateLive() {
  document.querySelectorAll('[data-end]').forEach(el => { el.textContent = fmtTime((+el.dataset.end - now()) / 1000); });
  document.querySelectorAll('[data-gemend]').forEach(el => { el.textContent = gemCost((+el.dataset.gemend - now()) / 1000); });
  const b = selB();
  if (b && b.upg) { const p = document.querySelector('#panel .prog i'); if (p) p.style.width = clamp(100 - (b.upg.end - now()) / (b.upg.total * 1000 / DEV) * 100, 0, 100) + '%'; }
}

/* ---------- panneau de bâtiment ---------- */
function statsOf(type, l) {
  const d = BUILDINGS[type], r = [];
  r.push(['Points de vie', fmtNum(d.hp(l))]);
  if (d.prod) { r.push(['Production', fmtNum(d.rate(l)) + '/h']); r.push(['Réserve interne', fmtNum(d.cap(l))]); }
  if (d.storeGold) r.push(['Stockage d\'or', fmtNum(d.storeGold(l))]);
  if (d.storeSap) r.push(['Stockage de sève', fmtNum(d.storeSap(l))]);
  if (type === 'citadel') r.push(['Stockage', fmtNum(d.store(l))]);
  if (d.atk) {
    const a = resolveAtk(type, l);
    r.push(['Dégâts / s', (a.dmg / a.rate).toFixed(1)]);
    if (a.aura) r.push(['Ralentissement', Math.round(a.slow * 100) + ' %']);
    r.push(['Portée', a.range + ' cases']);
    r.push(['Cibles', a.air && a.ground ? 'Sol et air' : a.ground ? 'Sol uniquement' : 'Air']);
  }
  if (d.housing) r.push(['Capacité', d.housing(l) + ' places']);
  if (type === 'barracks') { const un = UNIT_ORDER.find(k => UNITS[k].unlock === l); r.push(['Débloque', un ? UNITS[un].name : '—']); r.push(['Niveau des troupes', Math.ceil(l / 2)]); }
  return r;
}
function renderPanel() {
  const el = $('#panel'), b = selB();
  if (!b || G.mode !== 'village' || G.place) { el.classList.add('hidden'); return; }
  const d = BUILDINGS[b.type], l = Math.max(1, b.lvl), nl = b.lvl + 1;
  const cur = statsOf(b.type, l), nxt = nl <= d.maxLvl ? statsOf(b.type, nl) : null;
  let st = '<div class="stats">';
  cur.forEach(([k, v], i) => { const nv = nxt && nxt[i] && nxt[i][1] !== v && b.lvl >= 1 && !b.upg ? `<em>→ ${nxt[i][1]}</em>` : ''; st += `<div><span>${k}</span><b>${v}${nv}</b></div>`; });
  st += '</div>';
  let acts = '';
  if (b.upg) {
    const g = gemCost((b.upg.end - now()) / 1000);
    st += `<div class="prog"><i style="width:0"></i><span>${b.lvl === 0 ? 'Construction' : 'Amélioration vers niv. ' + nl} — <span data-end="${b.upg.end}"></span></span></div>`;
    acts += `<button class="btn gem" data-act="speed">${ic('gems', 1)} Terminer · <span data-gemend="${b.upg.end}">${g}</span></button>`;
    acts += `<button class="btn sec" data-act="cancel">Annuler</button>`;
  } else {
    const max = maxLvlOf(b.type);
    if (nl > d.maxLvl) acts += `<span class="note">Niveau maximum atteint</span>`;
    else if (nl > max) acts += `<span class="note warn">Niv. ${nl} : Citadelle niv. ${nl - 1} requise</span>`;
    else {
      const t = buildTime(b.type, nl);
      acts += `<button class="btn" data-act="upgrade">Améliorer · ${costHtml(buildCost(b.type, nl))}${t ? ` · ${ic('clock', 1)} ${fmtTime(t / DEV)}` : ''}</button>`;
    }
    if (d.prod && b.buf >= 1) acts += `<button class="btn green" data-act="collect">Récolter ${fmtNum(b.buf)}</button>`;
    if (b.type === 'wall' && nl <= max) { const n = S.buildings.filter(x => x.type === 'wall' && x.lvl === b.lvl).length; if (n > 1) acts += `<button class="btn sec" data-act="walls" data-arg="${b.lvl}">Toutes les murailles niv. ${b.lvl} (${n})</button>`; }
    if (b.type === 'barracks' || b.type === 'camp') acts += `<button class="btn sec" data-act="army">Entraîner</button>`;
    if (b.type === 'citadel') acts += `<button class="btn sec" data-act="collectAll">Tout récolter</button>`;
    acts += `<button class="btn sec" data-act="move">Déplacer</button>`;
    if (b.type === 'wall') acts += `<button class="btn sec" data-act="remove">Retirer</button>`;
  }
  let extra = '';
  if (b.type === 'citadel' && nl <= d.maxLvl) {
    const un = Object.keys(LIMITS).filter(k => k !== 'citadel' && k !== 'wall' && LIMITS[k][Math.min(8, nl)] > LIMITS[k][Math.min(8, l)]).map(k => BUILDINGS[k].name);
    if (un.length) extra = `<p class="note" style="margin:0 0 8px">Niv. ${nl} débloque : ${un.join(', ')} et de nouveaux niveaux.</p>`;
  }
  el.innerHTML = `<button class="x" data-act="deselect">×</button>
    <div class="ph"><img src="${buildingIcon(b.type, l)}" alt=""><div><h3>${d.name}<span class="lvl">${b.lvl === 0 ? 'En construction' : 'Niv. ' + b.lvl}</span></h3><p>${d.desc}</p></div></div>
    ${st}${extra}<div class="acts">${acts}</div>`;
  el.classList.remove('hidden');
  updateLive();
}
function renderPlacebar() {
  const el = $('#placebar');
  if (!G.place || G.mode !== 'village') { el.classList.add('hidden'); return; }
  const d = BUILDINGS[G.place.type];
  const msg = G.place.moveId ? `Déplacer : ${d.name}` : d.instant ? `${d.name} · ${costHtml(buildCost(G.place.type, 1))} · ${countType('wall')}/${limitOf('wall')}` : `${d.name} · ${costHtml(buildCost(G.place.type, 1))}`;
  el.innerHTML = `<span>${msg}<br><span class="note">Touchez la carte pour placer, touchez à nouveau pour confirmer</span></span>
    <button class="btn green sm" data-act="placeOk">✓</button><button class="btn red sm" data-act="placeNo">✕</button>`;
  el.classList.remove('hidden');
}

/* ---------- boutique ---------- */
function openShop() {
  UI_OPEN = 'shop';
  const cat = SHOP.find(c => c.id === UI_TAB) || SHOP[0];
  let h = `<h2>Bâtir</h2><p class="sub">Chaque construction mobilise un bâtisseur pendant toute sa durée. Bâtisseurs libres : <b>${S.builders - buildersBusy()}/${S.builders}</b></p><div class="tabs">`;
  for (const c of SHOP) h += `<button class="tab ${c.id === cat.id ? 'on' : ''}" data-act="tab" data-arg="${c.id}">${c.name}</button>`;
  h += '</div><div class="cards">';
  for (const t of cat.items) {
    const d = BUILDINGS[t], r = lockReason(t), cost = buildCost(t, 1), tm = buildTime(t, 1);
    h += `<div class="card ${r ? 'dis' : ''}" data-act="buy" data-arg="${t}"><img src="${buildingIcon(t, 1)}" alt="">
      <div class="nm">${d.name}</div><div class="meta"><span>${countType(t)}/${limitOf(t)}</span>${costHtml(cost)}<span>${tm ? ic('clock', 1) + ' ' + fmtTime(tm / DEV) : 'instantané'}</span></div>
      ${r ? `<em class="reason">${r}</em>` : ''}</div>`;
  }
  h += '</div>';
  openModal(h);
}
function openBuilders() {
  const c = BUILDER_COST[S.builders + 1];
  const busy = S.buildings.filter(b => b.upg && !BUILDINGS[b.type].instant);
  let h = `<h2>Bâtisseurs</h2><p class="sub">Les bâtisseurs travaillent en temps réel, même quand vous êtes absent. C'est la principale limite de votre progression : planifiez vos longues améliorations avant de partir.</p><div class="list">`;
  for (const b of busy) h += `<div class="item"><img src="${buildingIcon(b.type, Math.max(1, b.lvl))}" style="width:46px"><div class="grow"><b>${BUILDINGS[b.type].name}</b><p>${b.lvl === 0 ? 'Construction' : 'Vers niv. ' + (b.lvl + 1)} — <span data-end="${b.upg.end}"></span></p></div></div>`;
  for (let i = busy.length; i < S.builders; i++) h += `<div class="item"><div class="ico2">💤</div><div class="grow"><b>Bâtisseur disponible</b><p>Prêt à travailler.</p></div></div>`;
  h += '</div>';
  if (c) h += `<h4>Recruter</h4><div class="item"><div class="ico2">🔨</div><div class="grow"><b>Bâtisseur n°${S.builders + 1}</b><p>Un bâtisseur de plus, pour toujours.</p></div><button class="btn gem" data-act="buyBuilder">${ic('gems', 1)} ${c}</button></div>`;
  h += `<p class="note" style="margin-top:12px">Les cristaux s'obtiennent via le coffre quotidien, les quêtes, les assauts repoussés et les nouvelles étoiles d'expédition.</p>`;
  openModal(h); updateLive();
}

/* ---------- armée ---------- */
function openArmy() {
  UI_OPEN = 'army';
  const cap = housingCap(), used = housingUsed(), arm = housingArmy();
  const nb = S.buildings.filter(b => b.type === 'barracks' && b.lvl >= 1 && !b.upg).length;
  let h = `<h2>Armée</h2><p class="sub">Troupes de niveau <b>${troopLevel()}</b> · ${nb} caserne(s) active(s) · L'entraînement continue en votre absence.</p>
    <div class="row" style="gap:16px;margin-bottom:6px"><span class="chip" style="padding-left:10px">${ic('house', 1)} Campement : <b>${arm}</b> + ${used - arm} en formation / ${cap}</span></div>
    <div class="bar" style="height:8px;margin-bottom:12px"><i style="width:${clamp(used / Math.max(1, cap) * 100, 0, 100)}%;background:linear-gradient(90deg,#4f6fb3,#9ec0ff)"></i></div>`;
  if (armyTotal()) { h += '<div class="row">'; for (const k of UNIT_ORDER) if (S.army[k]) h += `<span class="chip"><img src="${unitIcon(k)}">${UNITS[k].name} × <b>${S.army[k]}</b></span>`; h += '</div>'; }
  if (S.trainQ.length) {
    const sec = S.trainQ.reduce((a, q) => a + q.left, 0) / Math.max(1, nb) / DEV;
    h += `<h4>En formation · ${fmtTime(sec)}</h4><div class="row">`;
    S.trainQ.slice(0, 24).forEach((q, i) => { h += `<span class="chip" data-act="untrain" data-arg="${i}" title="Annuler" style="cursor:pointer"><img src="${unitIcon(q.type)}">${i === 0 ? fmtTime(q.left / Math.max(1, nb) / DEV) : ''} ✕</span>`; });
    if (S.trainQ.length > 24) h += `<span class="chip" style="padding-left:10px">+${S.trainQ.length - 24}</span>`;
    h += `</div><div class="row" style="margin-top:8px"><button class="btn gem sm" data-act="finishTrain">${ic('gems', 1)} Terminer · ${gemCost(sec)}</button></div>`;
  }
  h += '<h4>Entraîner</h4><div class="cards">';
  for (const k of UNIT_ORDER) {
    const u = UNITS[k], lock = u.unlock > barracksLvl(), m = Math.pow(1.18, troopLevel() - 1);
    h += `<div class="card ${lock ? 'dis' : ''}" style="cursor:default"><img src="${unitIcon(k)}" style="width:70px;height:70px">
      <div class="nm">${u.name}</div><div class="meta"><span>❤ ${Math.round(u.hp * m)}</span>${u.dmg ? `<span>⚔ ${Math.round(u.dmg * m)}</span>` : `<span>✚ ${Math.round(u.heal * m)}/s</span>`}<span>${ic('house', 1)} ${u.housing}</span></div>
      <p class="note" style="margin:2px 0 4px;min-height:30px">${u.desc}</p>
      ${lock ? `<em class="reason">Caserne niv. ${u.unlock}</em>` : `<div class="meta">${costHtml({ sap: u.cost })}<span>${ic('clock', 1)} ${fmtTime(u.time / DEV)}</span></div>
      <div class="row" style="justify-content:center"><button class="btn sm" data-act="train" data-arg="${k}:1">+1</button><button class="btn sm" data-act="train" data-arg="${k}:5">+5</button></div>`}</div>`;
  }
  h += '</div>';
  openModal(h);
}

/* ---------- assaut (défense) ---------- */
function openRaid() {
  UI_OPEN = 'raid';
  const plan = getPendingPlan();
  let horns = '<div class="horns">'; for (let i = 0; i < HORN_MAX; i++) horns += `<div class="horn ${i < S.horns.n ? 'on' : ''}">${ICON.horn}</div>`; horns += '</div>';
  const next = S.horns.n < HORN_MAX ? `<span class="note">Prochaine corne dans <b data-end="${now() + hornNextIn() * 1000}"></b></span>` : '<span class="note">Cornes au maximum</span>';
  let comp = '<div class="row">';
  for (const k of UNIT_ORDER) if (plan.comp[k]) comp += `<span class="chip"><img src="${unitIcon(k)}">${UNITS[k].name} × ${plan.comp[k]}</span>`;
  comp += '</div>';
  const disabled = S.buildings.filter(b => b.upg && BUILDINGS[b.type].atk).length;
  const h = `<h2>Assaut nocturne</h2>
    <p class="sub">Sonnez une corne de guerre pour attirer les troupes du Seigneur des Cendres. Repoussez les 3 vagues pour gagner du butin, des cristaux et de la renommée. Chaque victoire augmente la menace.</p>
    <div class="row" style="justify-content:space-between">${horns}<div style="text-align:right">${next}<br><span class="chip" style="padding-left:10px;margin-top:6px">${ic('flame', 1)} Menace <b>${S.threat}</b> · ennemis niv. ${plan.lvl}</span></div></div>
    <h4>Rapport de vos espions</h4>
    <div class="report">${plan.report.map(r => `<p>${r}</p>`).join('')}</div>
    <h4>Forces ennemies repérées</h4>${comp}
    ${disabled ? `<p class="note warn" style="margin-top:10px">⚠ ${disabled} défense(s) en amélioration ne pourront pas tirer.</p>` : ''}
    <p class="note" style="margin-top:10px">Astuce : le plan ennemi est fixé. Vous pouvez réorganiser vos défenses avant de sonner la corne pour le déjouer !</p>
    <div class="row" style="justify-content:center;margin-top:14px"><button class="btn big ${S.horns.n ? '' : 'dis'}" data-act="defend">${ICON.horn} Sonner la corne</button></div>`;
  openModal(h); updateLive();
}

/* ---------- expéditions ---------- */
function openExpe() {
  UI_OPEN = 'expe';
  const max = expeUnlocked();
  if (UI_CAMP == null || UI_CAMP > max) UI_CAMP = max;
  let h = `<h2>Expéditions</h2><p class="sub">Attaquez les camps conçus par l'Architecte. Déployez vos troupes, détruisez 50 % pour une étoile, la citadelle pour une deuxième, tout pour la troisième. Chaque nouvelle étoile rapporte 3 cristaux.</p><div class="camps">`;
  const from = Math.max(1, max - 11);
  for (let n = max; n >= from; n--) {
    const c = AI.camp(n), st = S.expe.stars[n] || 0;
    h += `<div class="camp ${UI_CAMP === n ? 'sel' : ''}" data-act="camp" data-arg="${n}"><div class="row" style="justify-content:space-between"><span class="nm">${n}. ${c.name}</span>${starsHtml(st)}</div>
      <span class="note">${c.nDef} défenses · ${c.walls} murailles · ${costHtml({ gold: c.gold })} ${costHtml({ sap: c.sap })}</span></div>`;
  }
  h += `<div class="camp locked"><span class="nm">${max + 1}. ???</span><span class="note">Obtenez au moins une étoile au camp ${max}</span></div></div>`;
  const c = AI.camp(UI_CAMP), st = S.expe.stars[UI_CAMP] || 0;
  h += `<div class="detail"><canvas id="minimap" width="360" height="240"></canvas><div class="grow" style="flex:1;min-width:200px">
    <div class="nm" style="font:700 17px var(--title)">${c.name}</div>
    <p class="note">Disposition ${c.style} · niveau ${c.lvl} · ${starsHtml(st)}</p>
    <p class="note">Butin : ${costHtml({ gold: c.gold })} ${costHtml({ sap: c.sap })}${st ? ' (50 % en rejouant)' : ''}</p>
    <p class="note">Votre armée : <b>${armyTotal()}</b> troupes de niveau ${troopLevel()}. Les troupes déployées sont perdues.</p>
    <button class="btn big ${armyTotal() ? '' : 'dis'}" data-act="attack" data-arg="${UI_CAMP}">${ICON.army} Attaquer</button></div></div>`;
  openModal(h);
  drawMinimap($('#minimap'), c.layout);
}
function drawMinimap(cv, layout) {
  if (!cv) return; const c = cv.getContext('2d'); const W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  c.save(); c.translate(W / 2, 14); const k = Math.min(W / (MAP_N * TW), (H - 20) / (MAP_N * TH)); c.scale(k, k);
  poly(c, [pt(0, 0), pt(MAP_N, 0), pt(MAP_N, MAP_N), pt(0, MAP_N)]); c.fillStyle = '#7fb35c'; c.fill();
  const items = layout.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const ws = new Set(layout.filter(b => b.type === 'wall').map(b => b.x + ',' + b.y));
  const saved = R.glows; R.glows = [];
  for (const b of items) drawBuilding(c, Object.assign({ fill: 0.5 }, b), 1, { wallAt: (x, y) => ws.has(x + ',' + y) });
  R.glows = saved;
  c.restore();
}

/* ---------- quêtes et coffre ---------- */
function openQuests() {
  UI_OPEN = 'quests'; ensureQuests();
  const sd = nextStreakDay(), av = dailyAvailable();
  let days = '<div class="daily">';
  for (let i = 0; i < 7; i++) {
    const done = av ? i < sd : i < S.daily.streak % 7 || (S.daily.streak % 7 === 0 && S.daily.streak > 0);
    const isNow = av && i === sd;
    days += `<div class="d ${done ? 'done' : ''} ${isNow ? 'now' : ''}">Jour ${i + 1}<b>${DAILY_GEMS[i]}💎</b></div>`;
  }
  days += '</div>';
  const r = dailyReward(sd);
  let h = `<h2>Quêtes & coffre du jour</h2><p class="sub">Revenez chaque jour : votre série augmente les récompenses jusqu'au 7ᵉ jour. Les quêtes se renouvellent à minuit.</p>
    <div class="item"><div class="ico2">${ICON.chest}</div><div class="grow"><b>Coffre du jour — jour ${sd + 1}</b><p>${costHtml({ gold: r.gold })} ${costHtml({ sap: r.sap })} ${costHtml({ gems: r.gems })}</p></div>
    ${av ? `<button class="btn" data-act="daily">Ouvrir</button>` : `<span class="note">Prochain dans <b data-end="${now() + secondsToMidnight() * 1000}"></b></span>`}</div>${days}
    <h4>Quêtes du jour · renouvellement dans <span data-end="${now() + secondsToMidnight() * 1000}"></span></h4><div class="list">`;
  S.quests.list.forEach((q, i) => {
    const Q = QUESTS[q.id], rw = questReward(q), done = q.prog >= q.n;
    h += `<div class="item"><div class="ico2">${q.claimed ? '✅' : done ? '🏆' : '📜'}</div><div class="grow"><b>${Q.text(q.n)}</b><p>${fmtNum(q.prog)} / ${fmtNum(q.n)} · ${costHtml({ gems: rw.gems })} ${costHtml({ gold: rw.gold })} ${costHtml({ sap: rw.sap })}</p><div class="qbar"><i style="width:${q.prog / q.n * 100}%"></i></div></div>
      ${q.claimed ? '<span class="note">Réclamée</span>' : done ? `<button class="btn green" data-act="claim" data-arg="${i}">Réclamer</button>` : ''}</div>`;
  });
  h += '</div>';
  openModal(h); updateLive();
}

/* ---------- oracle ---------- */
function openOracle() {
  UI_OPEN = 'oracle';
  const tips = AI.advice();
  let h = `<h2>L'Oracle</h2><p class="sub">L'Oracle lit votre royaume et l'esprit de vos ennemis.</p><div class="list">`;
  for (const t of tips) h += `<div class="item"><div class="ico2">${t.ico}</div><div class="grow"><p style="color:var(--text)">${t.t}</p></div></div>`;
  h += `</div><div class="row" style="margin-top:12px"><button class="btn ${G.vision ? 'gem' : 'sec'}" data-act="vision">${ICON.eye} Vision de l'Oracle : ${G.vision ? 'activée' : 'désactivée'}</button>
    <span class="note">Affiche la couverture de vos défenses sur la carte (rouge = zone non protégée).</span></div>
    <h4>Mémoire du Seigneur des Cendres</h4><p class="sub">L'IA ennemie apprend de chaque assaut : elle renforce les unités qui vous ont fait le plus de dégâts.</p><div class="weights">`;
  for (const k of UNIT_ORDER) {
    const w = S.ai.w[k] || 1, unlocked = UNITS[k].threat <= S.threat;
    h += `<div class="w" style="${unlocked ? '' : 'opacity:.4'}"><span>${UNITS[k].name}</span><div class="bar"><i style="width:${w / 3 * 100}%"></i></div><span>${unlocked ? '×' + w.toFixed(2) : 'Men. ' + UNITS[k].threat}</span></div>`;
  }
  h += `</div><p class="note">Assauts : ${S.stats.defWin} repoussés · ${S.stats.defLoss} perdus · ${fmtNum(S.stats.kills)} ennemis vaincus</p>`;
  openModal(h);
}

/* ---------- options ---------- */
function openSettings() {
  const h = `<h2>Options</h2><p class="sub">Ambrevale sauvegarde automatiquement votre progression dans ce navigateur.</p>
    <div class="list">
      <div class="item"><div class="ico2">⏱️</div><div class="grow"><b>Rythme du jeu</b><p>Les améliorations, la production, l'entraînement et les cornes de guerre avancent en temps réel, même lorsque le jeu est fermé. ${DEV > 1 ? `<b class="warn">Mode test actif : temps × ${DEV}.</b>` : ''}</p></div></div>
      <div class="item"><div class="ico2">${SFX.muted ? '🔇' : '🔊'}</div><div class="grow"><b>Sons</b><p>Effets sonores synthétisés.</p></div><button class="btn sec" data-act="mute">${SFX.muted ? 'Activer' : 'Couper'}</button></div>
      <div class="item"><div class="ico2">❓</div><div class="grow"><b>Revoir l'introduction</b></div><button class="btn sec" data-act="showIntro">Afficher</button></div>
      <div class="item"><div class="ico2">🗑️</div><div class="grow"><b>Recommencer</b><p>Efface définitivement votre royaume.</p></div><button class="btn red" data-act="reset">Effacer</button></div>
    </div>`;
  openModal(h);
}
ACT.showIntro = () => showIntro();
ACT.mute = () => { SFX.toggle(); openSettings(); };
function showIntro() {
  openModal(`<h2>Bienvenue à Ambrevale</h2>
    <p class="sub">Votre royaume flotte au-dessus des nuages. Chaque nuit, le Seigneur des Cendres envoie ses hordes… et il apprend de chacune de ses défaites.</p>
    <div class="list">
      <div class="item"><div class="ico2">${ICON.build}</div><div class="grow"><b>Bâtissez et gérez</b><p>Mines et puits produisent de l'or et de la sève en continu, même quand vous êtes absent. Les améliorations prennent du temps réel : lancez-les avant de partir.</p></div></div>
      <div class="item"><div class="ico2">${ICON.shield}</div><div class="grow"><b>Défendez (tower defense)</b><p>Sonnez une corne de guerre pour lancer un assaut nocturne. Placez tours et murailles pour créer des couloirs mortels, et lancez Foudre et Gel pendant le combat.</p></div></div>
      <div class="item"><div class="ico2">${ICON.map}</div><div class="grow"><b>Attaquez</b><p>Entraînez des troupes et pillez les camps générés par l'Architecte pour gagner butin et étoiles.</p></div></div>
      <div class="item"><div class="ico2">${ICON.eye}</div><div class="grow"><b>Une IA qui s'adapte</b><p>L'ennemi analyse votre base, attaque votre flanc le plus faible et retient ce qui a fonctionné. Consultez l'Oracle pour lire dans son jeu.</p></div></div>
      <div class="item"><div class="ico2">${ICON.chest}</div><div class="grow"><b>Revenez chaque jour</b><p>Coffre quotidien, série de 7 jours, quêtes renouvelées à minuit et cornes qui se rechargent toutes les 2 heures.</p></div></div>
    </div>
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn big" data-act="intro">Commencer</button></div>`, true);
}
function showWelcome(away, ev, prodGold, prodSap) {
  const lines = [];
  if (prodGold >= 1) lines.push(`${ic('gold', 1)} <b>${fmtNum(prodGold)}</b> or produit — à récolter sur vos mines`);
  if (prodSap >= 1) lines.push(`${ic('sap', 1)} <b>${fmtNum(prodSap)}</b> sève puisée — à récolter sur vos puits`);
  for (const b of ev.upgrades) lines.push(`🔨 ${BUILDINGS[b.type].name} ${b.lvl === 1 ? 'construit' : 'amélioré au niv. ' + b.lvl}`);
  if (ev.trained) lines.push(`⚔️ ${ev.trained} troupe(s) entraînée(s)`);
  if (ev.horns) lines.push(`📯 ${ev.horns} corne(s) de guerre rechargée(s)`);
  if (dailyAvailable()) lines.push('🎁 Le coffre du jour est prêt !');
  if (!lines.length) return;
  openModal(`<h2>Bon retour, souverain</h2><p class="sub">Pendant votre absence (${fmtTime(away)}) :</p><div class="list">${lines.map(l => `<div class="item"><div class="grow">${l}</div></div>`).join('')}</div>
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn big" data-act="welcomeOk">Au travail !</button></div>`);
}
ACT.welcomeOk = () => { closeModal(); collectAll(); };

/* ---------- interface de combat ---------- */
function enterBattleUI() {
  $('#bottombar').classList.add('hidden'); $('#topbar').classList.add('hidden'); $('#panel').classList.add('hidden'); $('#placebar').classList.add('hidden');
  $('#battle-top').classList.remove('hidden'); $('#battle-bottom').classList.remove('hidden');
  fitCamera(); updateBattleUI(true);
}
function exitBattleUI() {
  $('#bottombar').classList.remove('hidden'); $('#topbar').classList.remove('hidden');
  $('#battle-top').classList.add('hidden'); $('#battle-bottom').classList.add('hidden');
}
let _bbSig = '';
function updateBattleUI(force) {
  const B = G.battle; if (!B) return;
  let top;
  if (G.mode === 'defense') {
    const cr = B.cit.hp / B.cit.maxHp;
    top = `<span class="ttl">Assaut · Vague ${Math.max(1, B.wave + 1)}/3</span>
      <span class="hpw">Citadelle<div class="bar"><i style="width:${cr * 100}%"></i></div></span>
      <span>☠ ${B.kills}</span><span>${ic('gold', 1)} ${fmtNum(B.loot.gold)}</span><span>${ic('sap', 1)} ${fmtNum(B.loot.sap)}</span>`;
  } else {
    const pct = B.destructionPct(); let st = 0; if (pct >= 0.5) st++; if (B.cit.dead) st++; if (pct >= 0.999) st++;
    top = `<span class="ttl">${G.camp.name}</span><span>${ic('clock', 1)} ${fmtTime(BATTLE_TIME - B.t)}</span>
      <span><b>${Math.floor(pct * 100)} %</b> ${starsHtml(st)}</span><span>${ic('gold', 1)} ${fmtNum(B.loot.gold)}</span><span>${ic('sap', 1)} ${fmtNum(B.loot.sap)}</span>`;
  }
  $('#battle-top').innerHTML = top;
  // barre du bas : seulement si elle change (évite de casser les clics)
  let bot = '';
  if (G.mode === 'defense') {
    for (const k in SPELLS) {
      const sp = SPELLS[k], n = G.charges[k] || 0, lock = CL() < sp.cl;
      bot += `<button class="tb ${G.spell === k ? 'on' : ''} ${n ? '' : 'empty'}" data-act="${n ? 'spell' : ''}" data-arg="${k}" title="${sp.desc}"><span class="spell" style="background:${k === 'bolt' ? 'radial-gradient(#eaf6ff,#5a7fd6)' : 'radial-gradient(#e6fbff,#4fb6e0)'}">${k === 'bolt' ? '⚡' : '❄️'}</span>${sp.name}<span class="n">${lock ? '🔒' : '×' + n}</span></button>`;
    }
  } else {
    for (const k of UNIT_ORDER) {
      if (!(S.army[k] > 0)) continue;
      const n = G.left[k] || 0;
      bot += `<button class="tb ${G.deploySel === k ? 'on' : ''} ${n ? '' : 'empty'}" data-act="troop" data-arg="${k}"><img src="${unitIcon(k)}">${UNITS[k].name}<span class="n">×${n}</span></button>`;
    }
  }
  bot += `<span class="sep"></span><button class="tb" data-act="speedx"><span class="spell" style="font:700 16px Inter">×${G.speed}</span>Vitesse</button>
    <button class="tb" data-act="retreat"><span class="spell">🏳️</span>${G.mode === 'defense' ? 'Abandonner' : 'Terminer'}</button>`;
  if (force || bot !== _bbSig) { $('#battle-bottom').innerHTML = bot; _bbSig = bot; }
}
function showEndModal(r) {
  SFX.play(r.win ? 'win' : 'lose');
  let h = `<div class="end-title ${r.win ? 'win' : 'lose'}">${r.win ? 'Victoire' : 'Défaite'}</div>`;
  h += `<div class="bigstars">${[0, 1, 2].map(i => i < r.stars ? ICON.star : ICON.starOff).join('')}</div>`;
  if (r.kind === 'defense') {
    h += `<p class="sub center">${r.win ? `Les hordes ont été repoussées. La menace monte au niveau <b>${S.threat}</b>.` : `Votre citadelle est tombée. La menace redescend au niveau <b>${S.threat}</b>.`} ${r.kills} ennemis vaincus.</p>`;
  } else {
    h += `<p class="sub center">${G.camp.name} détruit à <b>${Math.floor(r.pct * 100)} %</b>.${r.newStars ? ` ${r.newStars} nouvelle(s) étoile(s) !` : ''}${r.replay ? ' (butin réduit en rejouant)' : ''}</p>`;
  }
  h += `<div class="loot"><span>${ICON.gold} +${fmtNum(r.got.gold)}</span><span>${ICON.sap} +${fmtNum(r.got.sap)}</span>${r.got.gems ? `<span>${ICON.gems} +${r.got.gems}</span>` : ''}<span>${ICON.crown} ${r.renown >= 0 ? '+' : ''}${r.renown}</span></div>`;
  if (r.lost) h += `<p class="note center warn">Pillé : -${fmtNum(r.lost.gold)} or, -${fmtNum(r.lost.sap)} sève</p>`;
  if (r.quote) h += `<p class="quote">${r.quote}<br><span class="note">— le Seigneur des Cendres</span></p>`;
  h += `<div class="row" style="justify-content:center"><button class="btn big" data-act="endOk">Retour au royaume</button></div>`;
  openModal(h, true);
}
