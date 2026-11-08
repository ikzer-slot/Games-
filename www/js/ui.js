// Interface : HUD, outils, répartition de la colonie, panneaux, bulle de la Reine.
import { FLOWERS, DEFENSES, ENEMIES, SECTORS, hiveMaxHp, hiveUpgradeCost } from './data.js';
import { sfx, setSound, soundOn } from './audio.js';

const $ = (id) => document.getElementById(id);
const TUTO = [
  "Bienvenue, je suis ta Reine ! Mes butineuses récoltent le nectar des fleurs écloses ✨. Plante une Tulipe 🌷 près de la ruche.",
  "Les ennemis arrivent par les bords. Dans 🛡️ Défenses, place une Jarre à propolis 🏺 entre le bord et la ruche.",
  "Ouvre 🐝 Colonie pour répartir tes abeilles entre butineuses, gardiennes et nourrices… ou confie-moi la colonie avec le Pilote IA.",
  "Avant chaque vague, le côté visé par le Frelon chef s'allume en rouge ⚠️. Il apprend tes points faibles ! Touche ⚔️ Vague quand tu es prêt·e.",
];

export class UI {
  constructor(g) {
    this.g = g; this.tab = 'flowers';
    g.on('change', () => this.hud());
    g.on('tick', () => this.hud(true));
    g.on('toast', (m) => this.toast(m));
    g.on('defTap', (t) => this.defPanel(t));
    g.on('hiveTap', () => this.hivePanel());
    g.on('waveEnd', (d) => this.waveEnd(d));
    g.on('gameOver', (d) => this.gameOver(d));
    g.on('tutorial', (n) => this.tutorial(n));
    document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
      sfx('click'); this.tab = b.dataset.tab; g.tool = null;
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
      if (this.tab === 'colony' && g.s.tutorial === 2) g.nextTutorial();
      this.tools();
    });
    $('btnWave').onclick = () => { g.startWave(); };
    $('btnSpeed').onclick = () => { g.speed = g.speed === 1 ? 2 : 1; $('btnSpeed').textContent = 'x' + g.speed; sfx('click'); };
    $('btnPause').onclick = () => this.pause();
    $('btnMenu').onclick = () => this.settings(true);
    $('modalClose').onclick = () => this.close();
    $('modal').onclick = (e) => { if (e.target.id === 'modal') this.close(); };
    $('bubble').onclick = () => { $('bubble').hidden = true; };
  }

  pause(force) { this.g.paused = force ?? !this.g.paused; $('btnPause').textContent = this.g.paused ? '▶' : '⏸'; }

  hud(light) {
    const g = this.g, s = g.s; if (!s) return;
    const set = (id, html, warn) => {
      const el = $(id); el.classList.toggle('warn', !!warn);
      if (el.innerHTML !== html) { el.innerHTML = html; if (!light) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
    };
    set('honey', `🍯 ${Math.floor(s.honey)}`, s.honey < 10 || s.honey >= g.cap());
    set('pollen', `🌼 ${Math.floor(s.pollen)}`);
    set('bees', `🐝 ${Math.floor(s.bees)}<small>/${g.maxBees()}</small>`);
    set('hp', `❤️ ${Math.ceil(s.hiveHp)}`, s.hiveHp < hiveMaxHp(s.hiveLvl) * 0.3);
    document.body.classList.toggle('attack', s.phase === 'wave');
    if (s.phase === 'build') {
      $('waveLabel').textContent = s.wave ? `Calme · vague ${s.wave + 1}` : 'Calme';
      $('waveBar').style.width = Math.max(0, 100 - s.timer / (s.wave ? 35 : 60) * 100) + '%';
      $('waveInfo').textContent = s.warn ? `⚠️ ${SECTORS[s.warn.main]}` : `${Math.ceil(s.timer)}s`;
    } else if (s.phase === 'wave') {
      const left = g.queue.length + g.enemies.length;
      $('waveLabel').textContent = `⚔️ Vague ${s.wave}`;
      $('waveBar').style.width = (100 - left / (g.waveTotal || 1) * 100) + '%';
      $('waveInfo').textContent = `${left} ennemis`;
    }
    $('btnWave').hidden = s.phase !== 'build';
    if (!light) this.tools(); else this.refresh();
  }

  refresh() {
    document.querySelectorAll('#tools .tool[data-cost]').forEach(el => el.classList.toggle('poor', this.g.s.honey < +el.dataset.cost));
    if (this.tab === 'colony') this.paintRoles();
  }

  tools() {
    const g = this.g, el = $('tools');
    const on = (k, id) => g.tool?.kind === k && g.tool.id === id ? ' on' : '';
    let h = '';
    if (this.tab === 'flowers') {
      for (const [id, f] of Object.entries(FLOWERS)) h += `<button class="tool${on('flower', id)}" data-k="flower" data-id="${id}" data-cost="${f.cost}"><span class="ic">${f.emoji}</span><span class="nm">${f.name}</span><span class="ct">${f.cost} 🍯</span></button>`;
      h += `<button class="tool${on('shovel', 'x')}" data-k="shovel" data-id="x"><span class="ic">🪏</span><span class="nm">Arracher</span><span class="ct">&nbsp;</span></button>`;
      h += `<button class="tool" data-a="infoF"><span class="ic">❔</span><span class="nm">Infos</span><span class="ct">&nbsp;</span></button>`;
    } else if (this.tab === 'defense') {
      for (const [id, d] of Object.entries(DEFENSES)) h += `<button class="tool${on('def', id)}" data-k="def" data-id="${id}" data-cost="${d.cost}"><span class="ic">${d.emoji}</span><span class="nm">${d.name}</span><span class="ct">${d.cost} 🍯</span></button>`;
      h += `<button class="tool" data-a="infoD"><span class="ic">❔</span><span class="nm">Infos</span><span class="ct">&nbsp;</span></button>`;
    } else {
      const s = g.s;
      h = `<div class="colony">
        <div class="roles${s.auto ? ' auto' : ''}" id="roles">
          <div class="seg f" id="segF"></div><div class="seg g" id="segG"></div><div class="seg n" id="segN"></div>
          <div class="handle" id="h1"></div><div class="handle" id="h2"></div>
        </div>
        <div class="colony-row">
          <button class="pillbtn${s.auto ? ' on' : ''}" id="autoBtn">👑 Pilote IA ${s.auto ? 'activé' : 'désactivé'}</button>
          <button class="pillbtn" id="hiveBtn">🏠 Ruche</button>
          <button class="pillbtn" id="intelBtn">🕵️ Frelon chef</button>
        </div>
        <div class="why" id="why"></div>
      </div>`;
    }
    el.innerHTML = h;
    el.querySelectorAll('.tool').forEach(b => b.onclick = () => {
      sfx('click');
      if (b.dataset.a) return b.dataset.a === 'infoF' ? this.infoFlowers() : this.infoDefenses();
      const { k, id } = b.dataset;
      g.tool = g.tool?.kind === k && g.tool.id === id ? null : { kind: k, id }; g.selected = null;
      this.tools();
    });
    if (this.tab === 'colony') this.bindRoles();
    this.refresh();
  }

  paintRoles() {
    const s = this.g.s, a = s.alloc, n = Math.floor(s.bees);
    const F = Math.round(n * a.f), G = Math.min(n - F, Math.round(n * a.g)), N = n - F - G;
    const seg = (id, frac, label) => { const e = $(id); if (!e) return; e.style.flexBasis = (frac * 100) + '%'; e.textContent = frac > 0.12 ? label : ''; };
    seg('segF', a.f, `🌸 ${F}`); seg('segG', a.g, `🗡️ ${G}`); seg('segN', a.n, `🍼 ${N}`);
    const h1 = $('h1'), h2 = $('h2');
    if (h1) { h1.style.left = (a.f * 100) + '%'; h2.style.left = ((a.f + a.g) * 100) + '%'; }
    const why = $('why');
    if (why) why.textContent = s.auto ? `👑 ${s.queenWhy || 'Je réfléchis…'}` : '🌸 butineuses · 🗡️ gardiennes · 🍼 nourrices — fais glisser les poignées';
  }

  bindRoles() {
    const g = this.g, bar = $('roles');
    let drag = null;
    const pos = (ev) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); };
    bar.onpointerdown = (ev) => {
      if (g.s.auto) return;
      const p = pos(ev), a = g.s.alloc;
      drag = Math.abs(p - a.f) < Math.abs(p - (a.f + a.g)) ? 1 : 2;
      bar.setPointerCapture(ev.pointerId); bar.onpointermove(ev);
    };
    bar.onpointermove = (ev) => {
      if (!drag) return;
      const p = pos(ev), a = g.s.alloc;
      if (drag === 1) { const end = a.f + a.g; const f = Math.min(p, end); g.setAlloc(f, end - f); }
      else { const end = Math.max(p, a.f); g.setAlloc(a.f, end - a.f); }
      this.paintRoles();
    };
    bar.onpointerup = bar.onpointercancel = () => { drag = null; };
    $('autoBtn').onclick = () => { g.s.auto = !g.s.auto; g.queenT = 0; sfx('click'); this.tools(); };
    $('hiveBtn').onclick = () => this.hivePanel();
    $('intelBtn').onclick = () => this.intel();
    this.paintRoles();
  }

  // ---------- Modale ----------
  open(title, html, bind, opts = {}) {
    $('modalTitle').textContent = title; $('modalBody').innerHTML = html; $('modal').hidden = false;
    $('modalClose').hidden = !!opts.locked;
    this.onClose = opts.onClose; this.wasPaused = this.g.paused; this.g.paused = true;
    bind?.($('modalBody'));
  }
  close() {
    if ($('modal').hidden) return;
    $('modal').hidden = true; this.g.paused = this.wasPaused;
    const f = this.onClose; this.onClose = null; f?.();
  }
  toast(m) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = m;
    $('toasts').appendChild(t); setTimeout(() => t.remove(), 3000);
    while ($('toasts').children.length > 2) $('toasts').firstChild.remove();
  }
  bubble(text, ms = 8000) {
    const b = $('bubble'); b.innerHTML = text; b.hidden = false;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this.bt); if (ms) this.bt = setTimeout(() => { b.hidden = true; }, ms);
  }
  tutorial(n) { if (n < TUTO.length) this.bubble(TUTO[n] + '<small>Touche pour fermer</small>', 0); else $('bubble').hidden = true; }

  // ---------- Panneaux ----------
  defPanel(t) {
    const g = this.g;
    const render = () => {
      if (!t.def) return '';
      const d = t.def, def = DEFENSES[d.id], c = g.upgradeCost(t), L = d.lvl;
      const st = (lbl, arr, u = '') => arr && arr[0] !== arr[2] ? `<div>${lbl} : <b>${arr[L]}${u}</b>${L < 2 ? ` → <b style="color:var(--leaf)">${arr[L + 1]}${u}</b>` : ''}</div>` : '';
      return `<div class="card"><span class="em">${def.emoji}</span><div class="tx"><b>${def.name}</b> ${'⭐'.repeat(L)}<div class="sub">${def.desc}</div></div></div>
        <div class="card"><div class="tx">${st('Portée', def.range)}${st('Dégâts', def.dmg)}${st('Piqûres', def.dps, '/s')}${st('Cadence', def.rate, 's')}${d.id === 'lure' ? `<div>Réserve : <b>${d.honey}/15 🍯</b></div>` : ''}</div></div>
        <div class="btns"><button class="btn red" id="sell">Démonter +${Math.floor(d.spent * 0.6)} 🍯</button>
        ${d.id === 'lure' ? `<button class="btn honey" id="refill">Remplir</button>` : c != null ? `<button class="btn honey" id="up">Améliorer ${c} 🍯</button>` : '<button class="btn" disabled>Niveau max</button>'}</div>`;
    };
    const bind = (b) => {
      b.querySelector('#sell').onclick = () => { g.sell(t); this.close(); };
      const up = b.querySelector('#up'); if (up) up.onclick = () => { g.upgrade(t); b.innerHTML = render(); bind(b); };
      const rf = b.querySelector('#refill'); if (rf) rf.onclick = () => { g.refill(t); b.innerHTML = render(); bind(b); };
    };
    this.open(DEFENSES[t.def.id].name, render(), bind, { onClose: () => { g.selected = null; } });
  }

  hivePanel() {
    const g = this.g;
    const render = () => {
      const s = g.s, cost = hiveUpgradeCost(s.hiveLvl);
      return `<div class="card"><span class="em">🏠</span><div class="tx"><b>Ruche niveau ${s.hiveLvl}</b><div class="sub">❤️ ${Math.ceil(s.hiveHp)}/${hiveMaxHp(s.hiveLvl)} · 🐝 ${Math.floor(s.bees)}/${g.maxBees()} abeilles · 🍯 réserve ${g.cap()}</div></div></div>
        <div class="note">Chaque abeille mange du miel. Les nourrices transforment 🌼 pollen + 🍯 miel en nouvelles abeilles, tant qu'il reste de la place dans la ruche.</div>
        <div class="card"><div class="tx"><b>Agrandir la ruche</b><div class="sub">+10 abeilles max, +10 ❤️ max (et +15 de soin), réserve de miel plus grande</div></div><button class="btn honey" id="upHive">${cost} 🍯</button></div>
        <div class="stats"><div><b>${s.stats.kills}</b>ennemis vaincus</div><div><b>${Math.floor(s.stats.honey)}</b>miel récolté</div><div><b>${Math.floor(s.stats.born)}</b>abeilles nées</div><div><b>${s.stats.lost}</b>abeilles tombées</div></div>`;
    };
    const bind = (b) => b.querySelector('#upHive').onclick = () => { g.upgradeHive(); b.innerHTML = render(); bind(b); };
    this.open('Ta ruche', render(), bind);
  }

  intelHtml() {
    const c = this.g.chief, max = Math.max(0.01, ...c.mean);
    let h = '<div class="intel">';
    SECTORS.forEach((name, i) => {
      h += `<span>${name}</span><div class="tr"><div class="fl" style="width:${c.n[i] ? c.mean[i] / max * 100 : 0}%"></div></div><span>${c.n[i] ? c.mean[i].toFixed(2) : '?'}</span>`;
    });
    return h + '</div>';
  }
  intel() {
    const w = this.g.chief.weakest();
    this.open('🕵️ Le Frelon chef', `<div class="note">Le Frelon chef est une IA qui apprend par essais et erreurs (algorithme UCB1, un « bandit manchot »). Chaque vague, il note ce que chaque côté lui a rapporté : dégâts à la ruche, miel volé, distance parcourue. Puis il revient sur les côtés qui marchent… tout en testant les autres de temps en temps.</div>
      <h3>Ce qu'il pense de tes côtés (score moyen)</h3>${this.intelHtml()}
      <div class="note">${w ? `🎯 Selon lui, ton flanc <b>${w.name}</b> est le plus faible. Renforce-le, ou prépare un piège !` : 'Il ne t\'a pas encore attaqué : il va d\'abord tester chaque côté.'}</div>`);
  }

  infoFlowers() {
    let h = '<div class="note">Les fleurs poussent puis s\'ouvrent ✨. Les butineuses y récoltent miel et pollen, puis la fleur se recharge. Plus une fleur est proche de la ruche, plus les allers-retours sont rapides.</div>';
    for (const f of Object.values(FLOWERS)) h += `<div class="card"><span class="em">${f.emoji}</span><div class="tx"><b>${f.name}</b> · ${f.cost} 🍯 · pousse en ${f.grow}s<div class="sub">${f.honey} 🍯 + ${f.pollen} 🌼 par visite (toutes les ${f.cd}s). ${f.desc}</div></div></div>`;
    this.open('🌸 Fleurs', h);
  }
  infoDefenses() {
    let h = '<div class="note">Les fourmis, araignées et l\'ours marchent : ils contournent Chardons, Jarres et Postes (tu peux tracer un labyrinthe !). Frelons et papillons volent tout droit vers la ruche. L\'ours écrase tout sur son passage.</div>';
    for (const d of Object.values(DEFENSES)) h += `<div class="card"><span class="em">${d.emoji}</span><div class="tx"><b>${d.name}</b> · ${d.cost} 🍯${d.blocks ? ' · bloque le passage' : ''}<div class="sub">${d.desc}</div></div></div>`;
    h += '<h3>Ennemis</h3>';
    for (const e of Object.values(ENEMIES)) h += `<div class="card"><span class="em">${e.emoji || '🟠'}</span><div class="tx"><b>${e.name}</b>${e.flying ? ' · volant' : ' · au sol'}${e.boss ? ' · toutes les 5 vagues' : ''}<div class="sub">${e.hunter ? 'Chasse tes abeilles ! ' : ''}${e.crusher ? 'Écrase fleurs et défenses. ' : ''}Vole ${e.steal} 🍯 s'il atteint la ruche.</div></div></div>`;
    this.open('🛡️ Défenses', h);
  }

  waveEnd({ wave, bonus, learned }) {
    const best = learned.sort((a, b) => b.r - a.r)[0];
    this.toast(`🌅 Vague ${wave} repoussée ! +${bonus} 🍯`);
    if (best) setTimeout(() => this.bubble(`Le Frelon chef a noté que le flanc <b>${SECTORS[best.i]}</b> lui a rapporté ${best.r.toFixed(2)}. ${best.r > 0.6 ? 'Il risque d\'y revenir : renforce-le !' : 'Ta défense y a tenu bon.'}<small>Détails : 🐝 Colonie → 🕵️ Frelon chef</small>`, 9000), 600);
  }

  gameOver({ waves, best, stats }) {
    this.open('La ruche est tombée…', `<p style="text-align:center;font-size:46px;margin:0">🐝💔</p>
      <p style="text-align:center">Ta Reine s'envole vers une nouvelle prairie. Retente ta chance !</p>
      <div class="stats"><div><b>${waves}</b>vagues repoussées</div><div><b>${best}</b>record</div><div><b>${stats.kills}</b>ennemis vaincus</div><div><b>${Math.floor(stats.honey)}</b>miel récolté</div></div>
      <div class="btns"><button class="btn honey" id="again">🐝 Nouvelle ruche</button></div>`,
      (b) => b.querySelector('#again').onclick = () => { this.close(); this.onRestart?.(); }, { locked: true });
  }

  settings(inGame) {
    this.open('Réglages', `<div class="toggle"><span>🔊 Sons</span><button class="btn ${soundOn() ? '' : 'red'}" id="snd">${soundOn() ? 'Activés' : 'Coupés'}</button></div>
      <div class="btns">${inGame ? '<button class="btn red" id="quit">Sauver et quitter</button>' : ''}<button class="btn honey" id="ok">OK</button></div>`, (b) => {
      b.querySelector('#snd').onclick = (e) => { setSound(!soundOn()); this.onSettings?.({ sound: soundOn() }); e.target.textContent = soundOn() ? 'Activés' : 'Coupés'; e.target.classList.toggle('red', !soundOn()); };
      b.querySelector('#ok').onclick = () => this.close();
      const q = b.querySelector('#quit'); if (q) q.onclick = () => { this.close(); this.onQuit?.(); };
    });
  }

  how() {
    this.open('Comment jouer', `
      <div class="card"><span class="em">🌸</span><div class="tx"><b>Fais fleurir la prairie</b><div class="sub">Plante des fleurs : tes butineuses y récoltent miel 🍯 et pollen 🌼 toutes seules.</div></div></div>
      <div class="card"><span class="em">🐝</span><div class="tx"><b>Répartis ta colonie</b><div class="sub">Butineuses = miel, gardiennes = défense, nourrices = nouvelles abeilles. Chaque abeille mange du miel !</div></div></div>
      <div class="card"><span class="em">🛡️</span><div class="tx"><b>Défends la Reine</b><div class="sub">Les ennemis au sol contournent tes défenses : trace-leur un labyrinthe. Les volants foncent droit sur la ruche.</div></div></div>
      <div class="card"><span class="em">🕵️</span><div class="tx"><b>Un Frelon chef qui apprend</b><div class="sub">Une IA choisit le côté d'attaque et retient où tu es faible. Le côté visé s'allume en rouge avant chaque vague.</div></div></div>
      <div class="card"><span class="em">👑</span><div class="tx"><b>La Reine IA</b><div class="sub">Active le Pilote IA : la Reine simule l'avenir de la colonie et choisit la meilleure répartition, en t'expliquant pourquoi.</div></div></div>`);
  }

  confirmNew(yes) {
    this.open('Nouvelle ruche ?', `<p>La partie en cours sera remplacée.</p><div class="btns"><button class="btn red" id="no">Annuler</button><button class="btn honey" id="yes">Recommencer</button></div>`, (b) => {
      b.querySelector('#no').onclick = () => this.close();
      b.querySelector('#yes').onclick = () => { this.close(); yes(); };
    });
  }
}
