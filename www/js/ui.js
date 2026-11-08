// Interface DOM : HUD, barre d'outils, panneaux de gestion, Gaïa.
import { CROPS, TOWERS, ITEMS, ITEM_KEYS, ENEMIES, DAMAGE_LABEL } from './data.js';
import { TRAITS, TRAIT_LABEL } from './swarm.js';
import { askGaia, localTip } from './advisor.js';
import { sfx, setSound, soundOn } from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TUTORIAL = [
  "Bienvenue ! Je suis Gaïa 🌱, l'IA du potager. Tes carottes brillent : touche-les pour les récolter (ou glisse ton doigt dessus).",
  'Bravo ! Les nuisibles arrivent la nuit par la forêt 🌲. Ouvre 🛡️ Défendre et place un Graineur juste à côté du chemin.',
  "Les Graineurs tirent les graines 🌰 de ton silo. Dans 🌱 Planter, sème des Tournesols 🌻 pour en produire.",
  "Parfait ! Quand tu es prêt·e, touche 🌙 pour lancer la nuit plus tôt (bonus de pièces). Attention : l'Essaim apprend de tes défenses…",
];

export class UI {
  constructor(game, settings, saveSettings) {
    this.g = game; this.settings = settings; this.saveSettings = saveSettings;
    this.tab = 'farm'; this.modalOnClose = null; this.bubbleTimer = null; this.autoTipT = 0;
    this.bind();
    game.on('change', () => this.renderHud());
    game.on('tick', () => this.renderHud(true));
    game.on('toast', (m) => this.toast(m));
    game.on('towerTap', (r, c) => this.towerPanel(r, c));
    game.on('nightEnd', (d) => this.nightReport(d));
    game.on('gameOver', (d) => this.gameOverPanel(d));
    game.on('tutorial', (step) => this.tutorial(step));
  }

  bind() {
    document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
      sfx('click'); this.tab = b.dataset.tab;
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
      if (this.tab !== 'manage' && this.g.tool) this.g.tool = null;
      this.renderTools();
    }));
    $('btnNight').addEventListener('click', () => { this.g.startNight(); this.renderHud(); });
    $('btnSpeed').addEventListener('click', () => { this.g.speed = this.g.speed === 1 ? 2 : 1; $('btnSpeed').textContent = 'x' + this.g.speed; sfx('click'); });
    $('btnPause').addEventListener('click', () => this.togglePause());
    $('btnMenu').addEventListener('click', () => this.settingsPanel(true));
    $('modalClose').addEventListener('click', () => this.closeModal());
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    $('gaiaAvatar').addEventListener('click', () => this.gaia());
    $('gaiaBubble').addEventListener('click', () => this.hideBubble());
  }

  togglePause(force) {
    this.g.paused = force ?? !this.g.paused;
    $('btnPause').textContent = this.g.paused ? '▶' : '⏸';
  }

  // ---------- HUD ----------
  renderHud(light) {
    const g = this.g, s = g.s; if (!s) return;
    const set = (id, txt) => { const el = $(id); if (el.textContent !== txt) { el.textContent = txt; if (!light) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } } };
    set('coins', '🪙 ' + Math.floor(s.coins));
    set('hearts', '❤️ ' + s.hearts);
    set('rep', '⭐ ' + s.rep);
    document.body.classList.toggle('night', s.phase === 'night');
    if (s.phase === 'day') {
      $('phaseLabel').textContent = `☀️ Jour ${s.day}`;
      $('phaseBar').style.width = Math.min(100, s.dayTime / s.dayLen * 100) + '%';
      $('phaseInfo').textContent = `🌙 ${Math.ceil(s.dayLen - s.dayTime)}s`;
    } else if (s.phase === 'night') {
      const left = g.spawnQueue.length + g.enemies.length;
      $('phaseLabel').textContent = `🌙 Nuit ${s.day}`;
      const total = g.totalWave || left; if (!g.totalWave) g.totalWave = left;
      $('phaseBar').style.width = (100 - left / total * 100) + '%';
      $('phaseInfo').textContent = `🐛 ${left}`;
    } else if (s.phase === 'report') {
      $('phaseLabel').textContent = `🌅 Aube ${s.day}`;
      $('phaseBar').style.width = '100%';
      $('phaseInfo').textContent = '';
    }
    if (s.phase !== 'night') g.totalWave = 0;
    $('btnNight').hidden = s.phase !== 'day';
    const cap = g.cap();
    const stockHtml = ITEM_KEYS.map(k => {
      const low = Object.values(TOWERS).some(t => t.ammo === k) && s.stock[k] < 4 && this.hasTowerUsing(k);
      return `<span class="pill${low ? ' low' : ''}">${ITEMS[k].emoji} ${s.stock[k]}<small style="opacity:.55">/${cap}</small></span>`;
    }).join('') + `<span class="pill">🤖 ${s.robots.length}</span>`;
    if ($('stock').innerHTML !== stockHtml) $('stock').innerHTML = stockHtml;
    const deliverable = s.orders.filter(o => s.stock[o.item] >= o.qty).length;
    $('manageBadge').hidden = !deliverable; $('manageBadge').textContent = deliverable;
    if (!light) this.renderTools();
    else this.refreshAffordability();
    // Rafraîchit le panneau ouvert (marché, etc.)
    if (this.liveRefresh && !$('modal').hidden) this.liveRefresh();
  }

  hasTowerUsing(item) {
    let found = false;
    this.g.forCells(c => { if (c.tower && TOWERS[c.tower.id].ammo === item) found = true; });
    return found;
  }

  refreshAffordability() {
    document.querySelectorAll('#tools .tool[data-cost]').forEach(el => el.classList.toggle('poor', this.g.s.coins < +el.dataset.cost));
  }

  renderTools() {
    const g = this.g, tools = $('tools');
    let html = '';
    const sel = (kind, id) => g.tool && g.tool.kind === kind && g.tool.id === id ? ' on' : '';
    if (this.tab === 'farm') {
      for (const [id, c] of Object.entries(CROPS))
        html += `<button class="tool${sel('crop', id)}" data-kind="crop" data-id="${id}" data-cost="${c.cost}"><span class="ic">${c.emoji}</span><span class="nm">${c.name}</span><span class="ct">${c.cost}🪙</span></button>`;
      html += `<button class="tool${sel('shovel', 'shovel')}" data-kind="shovel" data-id="shovel"><span class="ic">🪏</span><span class="nm">Arracher</span><span class="ct">&nbsp;</span></button>`;
      html += `<button class="tool" data-action="info-crops"><span class="ic">❔</span><span class="nm">Infos</span><span class="ct">&nbsp;</span></button>`;
    } else if (this.tab === 'defend') {
      for (const [id, t] of Object.entries(TOWERS))
        html += `<button class="tool${sel('tower', id)}" data-kind="tower" data-id="${id}" data-cost="${t.cost}"><span class="ic">${t.icon}</span><span class="nm">${t.name}</span><span class="ct">${t.cost}🪙</span></button>`;
      html += `<button class="tool" data-action="info-towers"><span class="ic">❔</span><span class="nm">Infos</span><span class="ct">&nbsp;</span></button>`;
    } else {
      const s = g.s, deliverable = s.orders.filter(o => s.stock[o.item] >= o.qty).length;
      const items = [
        ['market', '🏪', 'Marché', ''], ['orders', '📜', 'Commandes', deliverable ? `<span class="badge">${deliverable}</span>` : ''],
        ['robots', '🤖', 'Robots', ''], ['silo', '🏚️', 'Silo', ''], ['swarm', '🧬', 'Essaim', ''], ['gaia', '🌱', 'Gaïa IA', ''],
      ];
      for (const [a, ic, nm, extra] of items)
        html += `<button class="tool" data-action="${a}"><span class="ic">${ic}</span><span class="nm">${nm}</span><span class="ct">&nbsp;</span>${extra}</button>`;
    }
    tools.innerHTML = html;
    tools.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => {
      sfx('click');
      const { kind, id, action } = b.dataset;
      if (action) return this.action(action);
      if (g.tool && g.tool.kind === kind && g.tool.id === id) g.tool = null;
      else { g.tool = { kind, id }; g.selected = null; }
      this.renderTools();
    }));
    this.refreshAffordability();
  }

  action(a) {
    const map = {
      market: () => this.marketPanel(), orders: () => this.ordersPanel(), robots: () => this.robotsPanel(),
      silo: () => this.siloPanel(), swarm: () => this.swarmPanel(), gaia: () => this.gaiaPanel(),
      'info-crops': () => this.infoCrops(), 'info-towers': () => this.infoTowers(),
    };
    map[a]?.();
  }

  // ---------- Modale ----------
  openModal(title, html, onBind, opts = {}) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    $('modal').hidden = false;
    $('modalClose').hidden = !!opts.noClose;
    this.modalOnClose = opts.onClose || null;
    this.liveRefresh = opts.live || null;
    this.wasPaused = this.g.paused;
    if (!opts.keepRunning) this.g.paused = true;
    onBind?.($('modalBody'));
  }
  closeModal() {
    if ($('modal').hidden) return;
    $('modal').hidden = true; this.liveRefresh = null;
    this.g.paused = this.wasPaused;
    const cb = this.modalOnClose; this.modalOnClose = null; cb?.();
  }
  rebind(fn) { const body = $('modalBody'); fn(body); }

  toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    $('toasts').appendChild(el); setTimeout(() => el.remove(), 3000);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }

  // ---------- Panneaux ----------
  marketPanel() {
    const g = this.g;
    const render = () => {
      const s = g.s;
      let h = s.market.event ? `<div class="note">📰 ${esc(s.market.event.text)}</div>` : '<div class="note">Les prix baissent quand tu vends beaucoup d\'un coup, puis remontent avec le temps. Surveille les événements !</div>';
      for (const k of ITEM_KEYS) {
        const m = g.mult(k), tgt = g.targetMult(k);
        const trend = m < tgt - 0.03 ? '<span class="up">▲</span>' : m > tgt + 0.03 ? '<span class="down">▼</span>' : '•';
        h += `<div class="card"><span class="em">${ITEMS[k].emoji}</span><div class="grow"><b>${ITEMS[k].name}</b> ${trend}<div class="sub">Stock ${s.stock[k]} · vente ${g.price(k).toFixed(1)}🪙 · achat ${g.buyPrice(k)}🪙 (x${m.toFixed(2)})</div></div>
          <div class="btns"><button class="btn" data-sell="${k}" data-n="1">-1</button><button class="btn" data-sell="${k}" data-n="999">Tout</button><button class="btn alt" data-buy="${k}" data-n="5">+5</button></div></div>`;
      }
      return h;
    };
    const bind = (body) => {
      body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { g.sell(b.dataset.sell, +b.dataset.n); refresh(); });
      body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { g.buy(b.dataset.buy, +b.dataset.n); refresh(); });
    };
    const refresh = () => { $('modalBody').innerHTML = render(); bind($('modalBody')); };
    this.openModal('🏪 Marché du village', render(), bind);
  }

  ordersPanel() {
    const g = this.g;
    const render = () => {
      const s = g.s;
      let h = `<div class="note">Livre les commandes avant la date limite pour gagner des pièces et de la réputation ⭐ (meilleurs prix, meilleures récompenses). Réputation actuelle : <b>${s.rep}</b></div>`;
      if (!s.orders.length) h += '<p>Aucune commande pour le moment. Reviens demain !</p>';
      for (const o of s.orders) {
        const ok = s.stock[o.item] >= o.qty, left = o.deadline - s.day;
        h += `<div class="card"><span class="em">${o.emoji}</span><div class="grow"><b>${esc(o.who)}</b><div class="sub">Veut ${o.qty} ${ITEMS[o.item].emoji} (tu en as ${s.stock[o.item]}) · ${left <= 0 ? '⚠️ dernier jour' : `encore ${left + 1} jours`}</div></div>
          <button class="btn" data-o="${o.id}" ${ok ? '' : 'disabled'}>+${o.reward}🪙</button></div>`;
      }
      return h;
    };
    const bind = (body) => body.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { g.deliver(+b.dataset.o); $('modalBody').innerHTML = render(); bind($('modalBody')); });
    this.openModal('📜 Commandes', render(), bind);
  }

  robotsPanel() {
    const g = this.g;
    const render = () => {
      const s = g.s;
      return `<div class="note">🤖 Les Robots-jardiniers sont de petits agents IA autonomes : ils évaluent en continu chaque case (valeur ÷ distance) pour décider quoi récolter ou replanter. Entretien : 4🪙 par robot et par jour.</div>
        <div class="card"><span class="em">🤖</span><div class="grow"><b>Robots actifs : ${s.robots.length}/3</b><div class="sub">Prochain robot : ${s.robots.length >= 3 ? '—' : g.robotCost() + '🪙'}</div></div>
        <button class="btn alt" id="buyRobot" ${s.robots.length >= 3 ? 'disabled' : ''}>Acheter</button></div>
        <div class="toggle"><span>♻️ Replantation automatique</span><button class="btn ${s.autoReplant ? '' : 'red'}" id="autoRep">${s.autoReplant ? 'Activée' : 'Désactivée'}</button></div>`;
    };
    const bind = (body) => {
      body.querySelector('#buyRobot').onclick = () => { g.buyRobot(); body.innerHTML = render(); bind(body); };
      body.querySelector('#autoRep').onclick = () => { g.s.autoReplant = !g.s.autoReplant; body.innerHTML = render(); bind(body); };
    };
    this.openModal('🤖 Robots-jardiniers', render(), bind);
  }

  siloPanel() {
    const g = this.g;
    const render = () => `<div class="note">Le silo stocke tes récoltes, qui servent à la fois de <b>marchandises</b> et de <b>munitions</b> pour tes Gardiens.</div>
      <div class="card"><span class="em">🏚️</span><div class="grow"><b>Capacité : ${g.cap()} par article</b><div class="sub">Niveau ${g.s.capLvl + 1} → +30 de capacité</div></div><button class="btn alt" id="upSilo">${g.siloCost()}🪙</button></div>`;
    const bind = (body) => body.querySelector('#upSilo').onclick = () => { g.upgradeSilo(); body.innerHTML = render(); bind(body); };
    this.openModal('🏚️ Silo', render(), bind);
  }

  swarmHtml(report) {
    const g = this.g, res = g.swarm.resistanceProfile(), avg = g.swarm.avgTraits();
    let h = '';
    if (report) h += report.lines.map(l => `<div class="note">🧬 ${esc(l)}</div>`).join('');
    h += '<h3>Résistances de l\'Essaim</h3>';
    for (const k of Object.keys(res)) h += `<div class="dna"><div class="lbl"><span>Dégâts ${DAMAGE_LABEL[k]}</span><b>${Math.round(res[k] * 100)}%</b></div><div class="track"><div class="fill" style="width:${res[k] / 0.7 * 100}%"></div></div></div>`;
    h += '<h3>ADN moyen</h3>';
    const max = Math.max(1, ...TRAITS.map(t => avg[t]));
    for (const t of TRAITS) if (!t.startsWith('res')) h += `<div class="dna"><div class="lbl"><span>${TRAIT_LABEL[t]}</span><b>${avg[t].toFixed(1)}</b></div><div class="track"><div class="fill" style="width:${avg[t] / max * 100}%"></div></div></div>`;
    const fit = g.swarm.speciesFit;
    if (Object.keys(fit).length) {
      h += '<h3>Efficacité des espèces</h3>';
      for (const [k, v] of Object.entries(fit).sort((a, b) => b[1] - a[1])) h += `<div class="card"><span class="em">${ENEMIES[k].emoji}</span><div class="grow"><b>${ENEMIES[k].name}</b><div class="sub">Score d'évolution : ${v.toFixed(2)}</div></div></div>`;
    }
    return h;
  }

  swarmPanel() {
    const intro = `<div class="note">L'Essaim est une IA évolutionnaire : chaque nuit, les nuisibles qui sont allés le plus loin transmettent leurs gènes, et les mutations favorisent les résistances aux dégâts que tu infliges le plus. Génération <b>${this.g.swarm.gen}</b>.</div>`;
    this.openModal('🧬 L\'Essaim', intro + this.swarmHtml(this.g.swarm.lastReport));
  }

  towerPanel(r, c) {
    const g = this.g;
    const render = () => {
      const t = g.cell(r, c)?.tower; if (!t) return '';
      const def = TOWERS[t.id], cost = g.upgradeCost(t), L = t.lvl;
      const stat = (label, arr, unit = '') => arr ? `<div>${label} : <b>${arr[L]}${unit}</b>${L < 2 ? ` → <span class="up">${arr[L + 1]}${unit}</span>` : ''}</div>` : '';
      let ammo = '';
      if (def.ammo) ammo = `<div class="note">Munitions : ${ITEMS[def.ammo].emoji} ${g.s.stock[def.ammo]} en stock · ${def.perAmmo} tirs par unité ${t.noAmmo ? '<br><b class="down">⚠️ À court de munitions !</b>' : ''}</div>`;
      return `<div class="card"><span class="em">${def.icon}</span><div class="grow"><b>${def.name}</b> ${'⭐'.repeat(L)}<div class="sub">${esc(def.desc)}</div></div></div>
        ${ammo}
        <div class="card"><div class="grow">${stat('Portée', def.range)}${stat('Dégâts', def.dmg)}${stat('Cadence', def.rate, 's')}${def.slow ? stat('Ralentissement', def.slow.map(v => Math.round(v * 100)), '%') : ''}${def.dmgType ? `<div>Type : <b>${DAMAGE_LABEL[def.dmgType]}</b></div>` : ''}</div></div>
        <div class="btns"><button class="btn red" id="sellT">Vendre +${Math.floor(t.spent * 0.6)}🪙</button>${cost != null ? `<button class="btn alt" id="upT">Améliorer ${cost}🪙</button>` : '<button class="btn" disabled>Niveau max</button>'}</div>`;
    };
    const bind = (body) => {
      body.querySelector('#sellT').onclick = () => { g.sellTower(r, c); this.closeModal(); };
      const up = body.querySelector('#upT'); if (up) up.onclick = () => { g.upgrade(r, c); body.innerHTML = render(); bind(body); };
    };
    this.openModal(TOWERS[g.cell(r, c).tower.id].name, render(), bind, { onClose: () => { g.selected = null; } });
  }

  infoCrops() {
    let h = '<div class="note">Plante sur l\'herbe, récolte quand ça brille ✨. Près de l\'eau 💧 = +50% de vitesse. Attention : les nuisibles grignotent les cultures au bord du chemin !</div>';
    for (const c of Object.values(CROPS)) h += `<div class="card"><span class="em">${c.emoji}</span><div class="grow"><b>${c.name}</b> · ${c.cost}🪙 · ${c.grow}s<div class="sub">Donne ${c.yield} ${ITEMS[c.item].emoji}. ${esc(c.desc)}</div></div></div>`;
    this.openModal('🌱 Cultures', h);
  }
  infoTowers() {
    let h = '<div class="note">Les Gardiens consomment tes récoltes comme munitions. Diversifie les types de dégâts : l\'Essaim s\'adapte !</div>';
    for (const t of Object.values(TOWERS)) h += `<div class="card"><span class="em">${t.icon}</span><div class="grow"><b>${t.name}</b> · ${t.cost}🪙${t.dmgType ? ' · ' + DAMAGE_LABEL[t.dmgType] : ''}<div class="sub">${esc(t.desc)}</div></div></div>`;
    h += '<h3>Nuisibles</h3>';
    for (const e of Object.values(ENEMIES)) h += `<div class="card"><span class="em">${e.emoji}</span><div class="grow"><b>${e.name}</b>${e.flying ? ' · volant' : ''}${e.boss ? ' · boss (toutes les 5 nuits)' : ''}<div class="sub">PV ${e.hp} · vitesse ${e.speed}</div></div></div>`;
    this.openModal('🛡️ Gardiens', h);
  }

  nightReport({ report, reward, day }) {
    this.g.tool = null;
    this.renderHud();
    const h = `<div class="card"><span class="em">🌅</span><div class="grow"><b>Nuit ${day} survécue !</b><div class="sub">Prime de l'aube : +${reward}🪙 · Grange : ${this.g.s.hearts}❤️</div></div></div>
      <h3>🧬 L'Essaim a évolué (génération ${report.gen})</h3>${this.swarmHtml(report)}
      <div class="btns" style="margin-top:12px"><button class="btn alt" id="goDay">☀️ Nouveau jour</button></div>`;
    this.openModal('Rapport de l\'aube', h, (b) => b.querySelector('#goDay').onclick = () => this.closeModal(), {
      onClose: () => { this.g.paused = false; this.g.nextDay(); this.renderHud(); setTimeout(() => this.bubble(localTip(this.g), 'local'), 1200); },
    });
  }

  gameOverPanel({ nights, best, stats }) {
    const h = `<p style="text-align:center;font-size:48px;margin:0">🐗💥🏚️</p><p style="text-align:center">La grange est tombée… mais l'Essaim se souviendra de toi.</p>
      <div class="over-stats"><div><b>${nights}</b>nuits survécues</div><div><b>${best}</b>record</div><div><b>${stats.kills}</b>nuisibles repoussés</div><div><b>${stats.harvest}</b>récoltes</div></div>
      <div class="btns"><button class="btn alt" id="again">🌱 Rejouer</button></div>`;
    this.openModal('Fin de partie', h, (b) => b.querySelector('#again').onclick = () => { this.closeModal(); this.onRestart?.(); }, { noClose: true });
  }

  settingsPanel(inGame) {
    const st = this.settings;
    const h = `<div class="toggle"><span>🔊 Sons</span><button class="btn ${soundOn() ? '' : 'red'}" id="snd">${soundOn() ? 'Activés' : 'Coupés'}</button></div>
      <label class="field">🤖 Gaïa connectée (optionnel)</label>
      <div class="sub" style="font-size:13px;color:var(--muted)">URL de ton proxy Claude (voir <code>server/gaia-proxy.mjs</code>). Laisse vide pour l'IA locale hors-ligne.</div>
      <input type="url" id="aiUrl" placeholder="https://mon-serveur.fr/gaia" value="${esc(st.aiUrl || '')}">
      <div class="btns" style="margin-top:14px">${inGame ? '<button class="btn red" id="quit">Quitter vers le menu</button>' : ''}<button class="btn alt" id="saveSt">OK</button></div>`;
    this.openModal('⚙️ Réglages', h, (b) => {
      b.querySelector('#snd').onclick = (e) => { setSound(!soundOn()); st.sound = soundOn(); e.target.textContent = soundOn() ? 'Activés' : 'Coupés'; e.target.classList.toggle('red', !soundOn()); this.saveSettings(); };
      b.querySelector('#saveSt').onclick = () => { st.aiUrl = b.querySelector('#aiUrl').value.trim(); this.saveSettings(); this.closeModal(); };
      const q = b.querySelector('#quit'); if (q) q.onclick = () => { st.aiUrl = b.querySelector('#aiUrl').value.trim(); this.saveSettings(); this.closeModal(); this.onQuit?.(); };
    });
  }

  howPanel() {
    this.openModal('📖 Comment jouer', `
      <div class="card"><span class="em">☀️</span><div class="grow"><b>Le jour : cultive</b><div class="sub">Plante, récolte (touche ou glisse), vends au marché, livre les commandes des villageois.</div></div></div>
      <div class="card"><span class="em">🌙</span><div class="grow"><b>La nuit : défends</b><div class="sub">Les nuisibles suivent le chemin jusqu'à ta grange et grignotent les cultures au passage.</div></div></div>
      <div class="card"><span class="em">🌻</span><div class="grow"><b>Tes récoltes = tes munitions</b><div class="sub">Graineur ← graines de Tournesol, Brûle-piment ← Piments, Catapulte ← Citrouilles. Vendre ou garder ? À toi de gérer !</div></div></div>
      <div class="card"><span class="em">🧬</span><div class="grow"><b>L'Essaim apprend</b><div class="sub">Une IA génétique fait évoluer les nuisibles chaque nuit pour contrer TA stratégie. Varie tes défenses.</div></div></div>
      <div class="card"><span class="em">🌱</span><div class="grow"><b>Gaïa, ton IA</b><div class="sub">Touche Gaïa à tout moment : elle analyse ta ferme et te conseille. Connecte-la à Claude dans les réglages.</div></div></div>
      <div class="card"><span class="em">🤖</span><div class="grow"><b>Automatise</b><div class="sub">Les Robots-jardiniers récoltent et replantent seuls.</div></div></div>`);
  }

  // ---------- Gaïa ----------
  bubble(text, src, ms = 7000) {
    const b = $('gaiaBubble');
    b.innerHTML = esc(text) + (src === 'claude' ? '<span class="src">✨ Conseil généré par Claude</span>' : '');
    b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this.bubbleTimer);
    if (ms) this.bubbleTimer = setTimeout(() => this.hideBubble(), ms);
  }
  hideBubble() { $('gaiaBubble').hidden = true; }

  async gaia(question) {
    const av = $('gaiaAvatar');
    if (av.classList.contains('thinking')) return;
    sfx('click'); av.classList.add('thinking');
    if (this.settings.aiUrl) this.bubble('Je réfléchis… 🤔', 'local', 0);
    const res = await askGaia(this.g, question);
    av.classList.remove('thinking');
    this.bubble(res.text, res.source, 9000);
    return res;
  }

  gaiaPanel() {
    const connected = !!this.settings.aiUrl;
    const h = `<div class="note">🌱 Gaïa analyse ta ferme (stocks, défenses, résistances de l'Essaim, marché, commandes) pour te conseiller.<br>Mode actuel : <b>${connected ? '✨ Connectée à Claude' : '📴 IA locale (hors-ligne)'}</b></div>
      ${connected ? `<label class="field">Pose une question à Gaïa</label><input type="text" id="q" maxlength="160" placeholder="Ex : comment contrer les escargots ?"><div class="btns" style="margin-top:8px"><button class="btn" id="ask">Demander</button></div>` : '<p>Pour discuter librement avec Gaïa, ajoute l\'URL de ton proxy Claude dans ⚙️ Réglages.</p><div class="btns"><button class="btn" id="ask">Un conseil !</button></div>'}
      <div id="answer"></div>`;
    this.openModal('🌱 Gaïa', h, (b) => {
      b.querySelector('#ask').onclick = async () => {
        const q = b.querySelector('#q')?.value.trim();
        b.querySelector('#answer').innerHTML = '<div class="note">Je réfléchis… 🤔</div>';
        const res = await askGaia(this.g, q);
        b.querySelector('#answer').innerHTML = `<div class="note">${esc(res.text)}${res.source === 'claude' ? '<br><small>✨ Généré par Claude</small>' : ''}</div>`;
      };
    });
  }

  tutorial(step) {
    if (step < TUTORIAL.length) this.bubble(TUTORIAL[step], 'local', 0);
    else this.hideBubble();
  }

  // Conseils spontanés pendant la journée.
  autoTip(dt) {
    const s = this.g.s; if (!s || s.phase !== 'day' || this.g.paused || s.tutorial < TUTORIAL.length) return;
    this.autoTipT += dt;
    if (this.autoTipT > 30 && $('gaiaBubble').hidden) { this.autoTipT = 0; this.bubble(localTip(this.g), 'local', 6000); }
  }
}
