/* Boussole — un geste, une micro-action, une app qui apprend ce qui marche pour toi.
 * 100 % local : aucune donnée ne quitte le téléphone. */
(() => {
  'use strict';

  // ---------------------------------------------------------------- Stockage
  const KEY = 'boussole:v1';
  const fresh = () => ({ name: '', onboarded: false, theme: 'auto', checkins: [], sessions: [], journal: [] });
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? Object.assign(fresh(), JSON.parse(raw)) : fresh();
    } catch { return fresh(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage indisponible : l'app continue */ }
  }

  // ---------------------------------------------------------------- Micro-actions
  // fit = pertinence de base pour chaque état : tendu / bas / calme / elan
  const ACTIONS = [
    { id: 'coherence', emoji: '🫁', title: 'Cohérence cardiaque', type: 'breath', secs: 120,
      desc: 'Respire au rythme du cercle : 5 s pour inspirer, 5 s pour expirer.',
      why: 'Ralentit le rythme cardiaque et apaise le stress en 2 minutes.',
      fit: { tendu: 1, bas: .5, calme: .4, elan: .2 } },
    { id: 'ancrage', emoji: '🖐️', title: 'Ancrage 5-4-3-2-1', type: 'steps', secs: 100,
      steps: ['Nomme 5 choses que tu vois', '4 choses que tu peux toucher', '3 sons que tu entends', '2 odeurs autour de toi', '1 chose que tu pourrais goûter'],
      why: 'Ramène ton attention dans l\'instant présent quand l\'esprit s\'emballe.',
      fit: { tendu: .95, bas: .4, calme: .2, elan: .1 } },
    { id: 'vider', emoji: '🗒️', title: 'Vide ta tête', type: 'write', burn: true,
      prompt: 'Écris tout ce qui t\'encombre. Personne ne le lira, et ce ne sera pas enregistré.',
      why: 'Mettre ses soucis par écrit réduit leur poids mental.',
      fit: { tendu: .9, bas: .6, calme: .2, elan: .1 } },
    { id: 'marche', emoji: '🚶', title: 'Marche de 5 minutes', type: 'timer', secs: 300,
      steps: ['Sors ou bouge, même dans ton couloir', 'Respire par le nez, regarde loin', 'Remarque 3 choses que tu n\'avais jamais vues', 'Encore un peu… tu y es presque'],
      why: 'Quelques minutes de mouvement suffisent à relancer l\'énergie et l\'humeur.',
      fit: { tendu: .6, bas: .8, calme: .6, elan: .4 } },
    { id: 'eau', emoji: '💧', title: 'Un grand verre d\'eau', type: 'simple',
      desc: 'Lève-toi, bois un grand verre d\'eau lentement, en savourant.',
      why: 'Une légère déshydratation suffit à faire chuter l\'énergie et la concentration.',
      fit: { tendu: .3, bas: .5, calme: .6, elan: .3 } },
    { id: 'etirements', emoji: '🙆', title: 'Étirements express', type: 'steps', secs: 120,
      steps: ['Bras vers le ciel, grandis-toi', 'Penche-toi doucement à gauche', 'Puis à droite', 'Roule les épaules en arrière', 'Laisse tomber la tête en avant, relâche la nuque', 'Secoue tout le corps'],
      why: 'Débloque les tensions physiques accumulées et réveille le corps.',
      fit: { tendu: .6, bas: .5, calme: .7, elan: .3 } },
    { id: 'lumiere', emoji: '☀️', title: 'Prends la lumière', type: 'timer', secs: 120,
      steps: ['Va près d\'une fenêtre ou dehors', 'Lève les yeux vers le ciel', 'Respire profondément', 'Laisse la lumière te réveiller'],
      why: 'La lumière naturelle régule l\'horloge interne et l\'énergie.',
      fit: { tendu: .3, bas: .7, calme: .8, elan: .2 } },
    { id: 'gratitude', emoji: '🙏', title: '3 gratitudes', type: 'write', journal: true,
      prompt: 'Note 3 petites choses pour lesquelles tu es reconnaissant·e aujourd\'hui.',
      why: 'Entraîne le cerveau à repérer le positif — un des effets les mieux étudiés.',
      fit: { tendu: .4, bas: .9, calme: .6, elan: .5 } },
    { id: 'message', emoji: '💌', title: 'Un message qui fait du bien', type: 'simple',
      desc: 'Envoie un message sincère à quelqu\'un que tu apprécies. Juste « je pensais à toi ».',
      why: 'Le lien social est le premier facteur de bien-être durable.',
      fit: { tendu: .3, bas: .85, calme: .6, elan: .7 } },
    { id: 'musique', emoji: '🎧', title: 'Une chanson qui te porte', type: 'timer', secs: 210,
      steps: ['Mets une chanson que tu adores', 'Ferme les yeux ou bouge si tu en as envie', 'Laisse-toi porter'],
      why: 'La musique agit directement sur les émotions en quelques secondes.',
      fit: { tendu: .5, bas: .8, calme: .4, elan: .5 } },
    { id: 'eaufroide', emoji: '🧊', title: 'Eau fraîche sur le visage', type: 'simple',
      desc: 'Passe de l\'eau fraîche sur ton visage et tes poignets pendant 30 secondes.',
      why: 'Le froid active le réflexe d\'apaisement et réveille d\'un coup.',
      fit: { tendu: .7, bas: .6, calme: .5, elan: .1 } },
    { id: 'ranger', emoji: '🧺', title: 'Range une seule chose', type: 'timer', secs: 120,
      steps: ['Choisis UNE petite zone : un bureau, un tiroir, un évier', 'Range-la, rien d\'autre', 'Admire le résultat'],
      why: 'Une petite victoire visible redonne une sensation de contrôle.',
      fit: { tendu: .7, bas: .4, calme: .3, elan: .6 } },
    { id: 'repos', emoji: '😌', title: 'Pause yeux fermés', type: 'breath', secs: 180,
      desc: 'Ferme les yeux, laisse ta respiration suivre le cercle. Tu n\'as rien à faire.',
      why: 'Un vrai temps mort recharge plus qu\'on ne le croit.',
      fit: { tendu: .5, bas: .4, calme: .9, elan: .1 } },
    { id: 'focus', emoji: '🎯', title: '10 minutes de focus', type: 'timer', secs: 600,
      steps: ['Choisis LA tâche que tu repousses', 'Téléphone face cachée', 'Avance, sans viser la perfection', 'Continue, tu es lancé·e'],
      why: 'Ton énergie est haute : c\'est le moment idéal pour avancer sur l\'important.',
      fit: { tendu: .2, bas: .1, calme: .3, elan: 1 } },
    { id: 'savourer', emoji: '✨', title: 'Savoure ce moment', type: 'write', journal: true,
      prompt: 'Qu\'est-ce qui va bien en ce moment ? Décris-le en détail pour t\'en souvenir.',
      why: 'Savourer un bon moment prolonge et amplifie l\'émotion positive.',
      fit: { tendu: .1, bas: .2, calme: .7, elan: .9 } },
    { id: 'compliment', emoji: '🤝', title: 'Fais un compliment', type: 'simple',
      desc: 'Fais un compliment sincère à quelqu\'un aujourd\'hui, en vrai ou par message.',
      why: 'Faire du bien aux autres est l\'un des plus sûrs moyens d\'en recevoir.',
      fit: { tendu: .2, bas: .4, calme: .6, elan: .9 } },
  ];
  const byId = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

  // ---------------------------------------------------------------- États émotionnels
  // m = humeur (-1 désagréable → +1 agréable), e = énergie (-1 basse → +1 haute)
  const quadrant = ({ m, e }) => (e >= 0 ? (m < 0 ? 'tendu' : 'elan') : (m < 0 ? 'bas' : 'calme'));
  const QUAD_LABEL = { tendu: 'Tendu·e', elan: 'Plein d\'élan', bas: 'À plat', calme: 'Serein·e' };

  function moodWord({ m, e }) {
    const mag = Math.hypot(m, e);
    if (mag < .22) return 'Neutre, ni bien ni mal';
    const words = {
      tendu: ['Un peu nerveux·se', 'Stressé·e', 'Sous pression'],
      elan: ['Bien', 'Motivé·e', 'Euphorique'],
      bas: ['Un peu bas', 'Fatigué·e et morose', 'Épuisé·e'],
      calme: ['Tranquille', 'Détendu·e', 'Profondément apaisé·e'],
    }[quadrant({ m, e })];
    return words[mag < .55 ? 0 : mag < .95 ? 1 : 2];
  }

  // Couleur d'un point du pad (interpolation bilinéaire entre 4 coins)
  const CORNERS = { tl: [255, 128, 96], tr: [255, 214, 92], bl: [120, 132, 214], br: [86, 214, 170] };
  function colorAt(m, e) {
    const x = (m + 1) / 2, y = (1 - e) / 2;
    const c = [0, 1, 2].map((i) =>
      (CORNERS.tl[i] * (1 - x) + CORNERS.tr[i] * x) * (1 - y) + (CORNERS.bl[i] * (1 - x) + CORNERS.br[i] * x) * y);
    return `rgb(${c.map(Math.round).join(',')})`;
  }
  let padImage = null;
  function padBackground() {
    if (padImage) return padImage;
    const n = 64, cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const ctx = cv.getContext('2d');
    for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
      ctx.fillStyle = colorAt((px / (n - 1)) * 2 - 1, 1 - (py / (n - 1)) * 2);
      ctx.fillRect(px, py, 1, 1);
    }
    return (padImage = cv.toDataURL());
  }

  // ---------------------------------------------------------------- Moteur d'apprentissage
  // Gain de bien-être d'une séance : surtout l'humeur, un peu l'énergie (sauf si on était tendu).
  function gainOf(s) {
    const dm = s.after.m - s.before.m;
    const de = s.after.e - s.before.e;
    const energyWeight = quadrant(s.before) === 'tendu' ? -0.15 : 0.3;
    return dm + energyWeight * de;
  }
  const toPts = (g) => Math.round(g * 50); // l'échelle -1..1 devient 0..100

  function learned(actionId, quad) {
    // Moyenne lissée (prior à 0) : quelques essais suffisent à faire bouger les choses.
    const all = state.sessions.filter((s) => s.actionId === actionId && s.after);
    const same = all.filter((s) => quadrant(s.before) === quad);
    const avg = (arr, k) => arr.reduce((t, s) => t + gainOf(s), 0) / (arr.length + k);
    return { score: 0.6 * avg(same, 1.5) + 0.4 * avg(all, 2), n: all.length };
  }

  function recommend(mood, exclude = []) {
    const quad = quadrant(mood);
    const recent = state.sessions.slice(-3).map((s) => s.actionId);
    const intensity = Math.min(1, Math.hypot(mood.m, mood.e));
    const ranked = ACTIONS.filter((a) => !exclude.includes(a.id)).map((a) => {
      const l = learned(a.id, quad);
      let score = a.fit[quad] + 2.2 * l.score;
      if (recent.includes(a.id)) score -= 0.35;
      if (intensity > .7 && a.id === 'focus' && quad !== 'elan') score -= 1;
      score += Math.random() * (l.n < 2 ? 0.3 : 0.15); // un peu d'exploration
      return { a, score, l };
    }).sort((x, y) => y.score - x.score);
    return ranked[0];
  }

  function reasonFor(pick, quad) {
    const { a, l } = pick;
    if (l.n >= 2 && l.score > 0.05) {
      return `Chez toi, ça marche : +${toPts(avgGain(a.id))} pts de bien-être en moyenne sur ${l.n} essais.`;
    }
    if (l.n === 0) return a.why + ' Tu ne l\'as jamais essayé : on teste ?';
    return a.why;
  }
  function avgGain(id) {
    const s = state.sessions.filter((x) => x.actionId === id && x.after);
    return s.length ? s.reduce((t, x) => t + gainOf(x), 0) / s.length : 0;
  }

  // ---------------------------------------------------------------- Utilitaires
  const app = document.getElementById('app');
  const tabbar = document.getElementById('tabbar');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
  let cleanup = null;

  function render(html) {
    if (cleanup) { cleanup(); cleanup = null; }
    app.innerHTML = `<div class="screen">${html}</div>`;
    window.scrollTo(0, 0);
  }

  function greeting() {
    const h = new Date().getHours();
    const base = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    return state.name ? `${base}, ${esc(state.name)}` : base;
  }

  function streak() {
    const days = new Set(state.checkins.map((c) => dayKey(c.t)));
    let n = 0; const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function applyTheme() {
    if (state.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', state.theme);
  }

  // ---------------------------------------------------------------- Pad émotionnel
  function padHTML(hint) {
    return `
      <div class="pad-wrap">
        <div class="pad" id="pad" style="background-image:url(${padBackground()})" role="slider"
             aria-label="Touche l'endroit qui correspond à ton humeur et ton énergie" tabindex="0">
          <div class="axis h"></div><div class="axis v"></div>
          <span class="corner tl">⚡ Tendu·e</span><span class="corner tr">Plein d'élan ☀️</span>
          <span class="corner bl">🌧 À plat</span><span class="corner br">Serein·e 🌿</span>
          <div class="hint" id="padHint">${hint}</div>
          <div class="dot" id="dot" hidden></div>
        </div>
        <div class="axis-labels"><span>← Désagréable</span><span>↕ Énergie</span><span>Agréable →</span></div>
      </div>
      <div class="mood-word" id="moodWord"></div>`;
  }

  // Branche le pad ; onPick(mood) est appelé quand l'utilisateur relâche le doigt.
  function bindPad(onPick) {
    const pad = document.getElementById('pad');
    const dot = document.getElementById('dot');
    const word = document.getElementById('moodWord');
    const hint = document.getElementById('padHint');
    let mood = null, dragging = false;

    const place = (m, e) => {
      mood = { m: Math.max(-1, Math.min(1, m)), e: Math.max(-1, Math.min(1, e)) };
      dot.hidden = false; hint.hidden = true;
      dot.style.left = `${((mood.m + 1) / 2) * 100}%`;
      dot.style.top = `${((1 - mood.e) / 2) * 100}%`;
      dot.style.background = colorAt(mood.m, mood.e);
      word.textContent = moodWord(mood);
    };
    const fromEvent = (ev) => {
      const r = pad.getBoundingClientRect();
      place(((ev.clientX - r.left) / r.width) * 2 - 1, 1 - ((ev.clientY - r.top) / r.height) * 2);
    };
    pad.addEventListener('pointerdown', (ev) => { dragging = true; pad.setPointerCapture(ev.pointerId); fromEvent(ev); vibrate(8); });
    pad.addEventListener('pointermove', (ev) => { if (dragging) fromEvent(ev); });
    pad.addEventListener('pointerup', () => { if (!dragging) return; dragging = false; vibrate(15); onPick(mood); });
    pad.addEventListener('pointercancel', () => { dragging = false; });
    // Accessibilité clavier : flèches pour bouger, Entrée pour valider
    pad.addEventListener('keydown', (ev) => {
      const cur = mood || { m: 0, e: 0 }, st = 0.1;
      const moves = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] };
      if (moves[ev.key]) { ev.preventDefault(); place(cur.m + moves[ev.key][0], cur.e + moves[ev.key][1]); }
      if (ev.key === 'Enter' && mood) onPick(mood);
    });
  }

  // ---------------------------------------------------------------- Écrans
  function showOnboarding() {
    tabbar.hidden = true;
    render(`
      <div class="onboard">
        <img class="logo" src="icon.svg" alt="">
        <h1>Boussole</h1>
        <p class="muted">2 minutes pour aller mieux. Vraiment.</p>
        <div class="promise">
          <div><b>👆</b><span><strong>Un seul geste</strong> pour dire comment tu te sens. Pas de questionnaire.</span></div>
          <div><b>⏱</b><span><strong>Une micro-action</strong> de 2 minutes, choisie pour ton état du moment.</span></div>
          <div><b>🧠</b><span><strong>Elle apprend</strong> ce qui marche vraiment pour <em>toi</em>, et s'améliore à chaque fois.</span></div>
          <div><b>🔒</b><span><strong>Rien ne quitte ton téléphone.</strong> Pas de compte, pas de pub.</span></div>
        </div>
        <label class="small muted" for="name">Comment t'appelles-tu ? (facultatif)</label>
        <input type="text" id="name" maxlength="30" autocomplete="given-name" placeholder="Ton prénom" style="margin:6px 0 16px">
        <button class="btn" id="start">Commencer</button>
      </div>`);
    document.getElementById('start').onclick = () => {
      state.name = document.getElementById('name').value.trim();
      state.onboarded = true; save();
      go('today');
    };
  }

  function showToday() {
    const s = streak();
    const today = state.checkins.filter((c) => dayKey(c.t) === dayKey(Date.now())).length;
    render(`
      <div class="row"><span class="pill">🔥 ${s} jour${s > 1 ? 's' : ''}</span><span class="spacer"></span>
        <span class="pill">${today ? `✓ ${today} check-in${today > 1 ? 's' : ''} aujourd'hui` : 'Premier check-in du jour'}</span></div>
      <h1 style="margin-top:18px">${greeting()}.</h1>
      <p class="muted">Comment te sens-tu, là, maintenant ? Pose ton doigt.</p>
      ${padHTML('Touche pour répondre')}
      <div id="recoSlot"></div>`);
    bindPad((mood) => {
      state.checkins.push({ t: Date.now(), ...mood }); save();
      showReco(mood, []);
    });
  }

  function showReco(mood, excluded) {
    const quad = quadrant(mood);
    const pick = recommend(mood, excluded);
    if (!pick) { excluded = []; return showReco(mood, []); }
    const { a } = pick;
    const slot = document.getElementById('recoSlot');
    slot.innerHTML = `
      <div class="card reco screen">
        <div class="tag">Pour toi, maintenant · ${QUAD_LABEL[quad]}</div>
        <div class="row" style="margin-top:10px"><div class="emoji">${a.emoji}</div>
          <div><h2 style="margin:0">${a.title}</h2>
          <div class="small muted">${a.secs ? `${Math.round(a.secs / 60)} min` : '1 min'} · ${a.type === 'write' ? 'écrire' : a.type === 'breath' ? 'respirer' : 'agir'}</div></div></div>
        <div class="why">${esc(reasonFor(pick, quad))}</div>
        <button class="btn" id="go" style="margin-top:16px">C'est parti</button>
        <div class="row" style="justify-content:space-between">
          <button class="link" id="other">Autre idée</button>
          <button class="link" id="skip">Juste noter mon humeur</button>
        </div>
      </div>`;
    slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('go').onclick = () => startAction(a, mood);
    document.getElementById('other').onclick = () => {
      const ex = [...excluded, a.id];
      showReco(mood, ex.length >= ACTIONS.length ? [] : ex);
    };
    document.getElementById('skip').onclick = () => {
      slot.innerHTML = `<div class="card center screen"><p style="margin:0">C'est noté 💛 Reviens quand tu veux.</p></div>`;
    };
  }

  // ---------------------------------------------------------------- Exécution d'une action
  function startAction(a, before) {
    tabbar.hidden = true;
    const done = (extra = {}) => askAfter(a, before, extra);
    const header = `<div class="row"><button class="link" id="quit">✕ Quitter</button></div>
      <div class="big-emoji">${a.emoji}</div><h1>${a.title}</h1>`;

    if (a.type === 'simple') {
      render(`<div class="action-screen">${header}
        <p class="step">${a.desc}</p>
        <button class="btn" id="done">C'est fait ✓</button></div>`);
    } else if (a.type === 'write') {
      render(`<div class="action-screen">${header}
        <p class="muted">${a.prompt}</p>
        <textarea id="txt" placeholder="Écris ici…" autofocus></textarea>
        <button class="btn" id="done" style="margin-top:14px">${a.burn ? 'Lâcher prise 🔥' : 'Enregistrer ✓'}</button></div>`);
    } else {
      const total = a.secs;
      const breath = a.type === 'breath';
      const C = 2 * Math.PI * 104;
      render(`<div class="action-screen">${header}
        <div class="ring">
          <svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="104" fill="none" stroke="var(--line)" stroke-width="8"/>
            <circle id="arc" cx="110" cy="110" r="104" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
          ${breath ? '<div class="breath" id="breath"></div>' : `<div class="timer" id="clock">${fmt(total)}</div>`}
        </div>
        ${breath ? `<div class="timer" id="clock" style="font-size:28px">${fmt(total)}</div>` : ''}
        <p class="step" id="step">${breath ? 'Inspire…' : esc(a.steps[0])}</p>
        <button class="btn ghost" id="done">J'ai fini</button></div>`);

      const start = Date.now();
      const arc = document.getElementById('arc');
      const clock = document.getElementById('clock');
      const step = document.getElementById('step');
      const ball = document.getElementById('breath');
      let lastPhase = -1, finished = false;
      const tick = () => {
        const el = (Date.now() - start) / 1000;
        const left = Math.max(0, total - el);
        clock.textContent = fmt(Math.ceil(left));
        arc.setAttribute('stroke-dashoffset', String(C * (el / total)));
        if (breath) {
          const phase = Math.floor(el / 5);
          if (phase !== lastPhase) {
            lastPhase = phase;
            const inhale = phase % 2 === 0;
            ball.classList.toggle('inhale', inhale);
            step.textContent = a.desc && phase === 0 ? a.desc : inhale ? 'Inspire…' : 'Expire…';
            vibrate(inhale ? 20 : [10, 60, 10]);
          }
        } else {
          const i = Math.min(a.steps.length - 1, Math.floor((el / total) * a.steps.length));
          if (i !== lastPhase) { lastPhase = i; step.textContent = a.steps[i]; if (i) vibrate(20); }
        }
        if (left <= 0 && !finished) {
          finished = true; vibrate([40, 80, 40]);
          step.textContent = 'Terminé. Bravo 👏';
          const b = document.getElementById('done');
          b.classList.remove('ghost'); b.textContent = 'Continuer';
        }
      };
      requestAnimationFrame(() => { if (breath) ball.classList.add('inhale'); });
      const iv = setInterval(tick, 250); tick();
      cleanup = () => clearInterval(iv);
    }

    document.getElementById('quit').onclick = () => go('today');
    document.getElementById('done').onclick = () => {
      if (a.type !== 'write') return done();
      const ta = document.getElementById('txt');
      const text = ta.value.trim();
      if (a.journal && text) { state.journal.push({ t: Date.now(), actionId: a.id, text }); save(); }
      if (a.burn && text) { ta.classList.add('burn'); setTimeout(done, 1300); } else done();
    };
  }

  function askAfter(a, before, extra) {
    render(`
      <h1>Et maintenant ?</h1>
      <p class="muted">Repose ton doigt. C'est comme ça que Boussole apprend ce qui marche pour toi.</p>
      ${padHTML('Comment te sens-tu après ?')}
      <button class="link" id="nope" style="display:block;margin:6px auto 0">Passer</button>`);
    // Point fantôme : l'état d'avant, pour comparer
    const pad = document.getElementById('pad');
    const ghost = document.createElement('div');
    ghost.className = 'dot';
    Object.assign(ghost.style, { left: `${((before.m + 1) / 2) * 100}%`, top: `${((1 - before.e) / 2) * 100}%`, opacity: .35, transform: 'scale(.7)' });
    pad.appendChild(ghost);

    bindPad((after) => {
      const session = { t: Date.now(), actionId: a.id, before, after, ...extra };
      state.sessions.push(session);
      state.checkins.push({ t: Date.now(), ...after, after: true });
      save();
      setTimeout(() => showResult(session), 350);
    });
    document.getElementById('nope').onclick = () => {
      state.sessions.push({ t: Date.now(), actionId: a.id, before, after: null }); save();
      go('today');
    };
  }

  function showResult(s) {
    const a = byId[s.actionId];
    const pts = toPts(gainOf(s));
    const n = state.sessions.filter((x) => x.actionId === a.id && x.after).length;
    const msg = pts >= 10 ? 'Belle remontée !' : pts > 0 ? 'Un petit mieux, ça compte.' : pts === 0 ? 'Stable. Parfois c\'est déjà bien.' : 'Pas cette fois — c\'est noté.';
    const learnMsg = pts > 0
      ? `Boussole te proposera « ${a.title} » plus souvent dans cet état.`
      : `Boussole essaiera autre chose la prochaine fois. Chaque réponse l'affine.`;
    render(`
      <div class="center" style="padding-top:30px">
        <div class="big-emoji">${a.emoji}</div>
        <div class="gain ${pts >= 0 ? 'up' : 'down'}">${pts > 0 ? '+' : ''}${pts}</div>
        <p class="muted" style="margin-top:-4px">points de bien-être</p>
        <h1>${msg}</h1>
        <div class="card" style="text-align:left;margin-top:20px">
          <div class="insight"><div class="e">🧠</div><div><strong>Ce que Boussole a appris</strong>
          <p class="small muted" style="margin:4px 0 0">${learnMsg} (${n} essai${n > 1 ? 's' : ''} de cette action)</p></div></div>
        </div>
        <button class="btn" id="home">Terminer</button>
        <button class="btn ghost" id="prog">Voir mes progrès</button>
      </div>`);
    if (pts > 0) confetti();
    document.getElementById('home').onclick = () => go('today');
    document.getElementById('prog').onclick = () => go('progress');
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = ['#ff8a65', '#ffd54f', '#4dd0a8', '#8f8cff', '#7884d6'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('i');
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = `${Math.random() * .5}s`;
      p.style.animationDuration = `${1.4 + Math.random()}s`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3200);
  }

  // ---------------------------------------------------------------- Progrès
  function showProgress() {
    const done = state.sessions.filter((s) => s.after);
    const avgPts = done.length ? Math.round(done.reduce((t, s) => t + toPts(gainOf(s)), 0) / done.length) : 0;

    // Humeur moyenne des 14 derniers jours
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
      const list = state.checkins.filter((c) => dayKey(c.t) === dayKey(d));
      const m = list.length ? list.reduce((t, c) => t + c.m, 0) / list.length : null;
      const e = list.length ? list.reduce((t, c) => t + c.e, 0) / list.length : null;
      days.push({ d, m, e });
    }
    const bars = days.map(({ d, m, e }) => `
      <div class="col">${m === null
        ? '<div class="bar empty"></div>'
        : `<div class="bar" style="height:${Math.max(6, ((m + 1) / 2) * 100)}%;background:${colorAt(m, e)}" title="Humeur ${Math.round((m + 1) * 50)}/100"></div>`}
        <span class="d">${'DLMMJVS'[d.getDay()]}</span></div>`).join('');

    // Ce qui marche pour toi
    const stats = ACTIONS.map((a) => {
      const s = done.filter((x) => x.actionId === a.id);
      return { a, n: s.length, pts: s.length ? Math.round(s.reduce((t, x) => t + toPts(gainOf(x)), 0) / s.length) : 0 };
    }).filter((x) => x.n).sort((x, y) => y.pts - x.pts);
    const maxPts = Math.max(10, ...stats.map((x) => x.pts));
    const works = stats.length ? stats.slice(0, 6).map(({ a, n, pts }) => `
      <div class="works"><div class="e">${a.emoji}</div>
        <div style="flex:1"><div class="row"><span>${a.title}</span><span class="spacer"></span>
          <span class="v" style="color:${pts >= 0 ? 'var(--good)' : 'var(--bad)'}">${pts > 0 ? '+' : ''}${pts}</span></div>
          <div class="meter"><i style="width:${Math.max(0, (pts / maxPts) * 100)}%"></i></div>
          <div class="small muted">${n} essai${n > 1 ? 's' : ''}</div></div></div>`).join('')
      : '<p class="muted small" style="margin:0">Fais ta première micro-action : ton classement personnel apparaîtra ici.</p>';

    render(`
      <h1>Tes progrès</h1>
      <p class="muted">Tout est calculé sur ton téléphone, rien n'est envoyé.</p>
      <div class="stats">
        <div class="stat"><b>${streak()}</b><span>jours d'affilée</span></div>
        <div class="stat"><b>${done.length}</b><span>micro-actions</span></div>
        <div class="stat"><b style="color:${avgPts >= 0 ? 'var(--good)' : 'var(--bad)'}">${avgPts > 0 ? '+' : ''}${avgPts}</b><span>pts moyens</span></div>
      </div>
      <div class="card"><h2>Ton humeur, 14 jours</h2><div class="chart">${bars}</div></div>
      ${insightsCard()}
      <div class="card"><h2>Ce qui marche pour toi</h2>${works}</div>
      ${journalCard()}`);
  }

  function insightsCard() {
    const out = [];
    const c = state.checkins.filter((x) => !x.after);
    if (c.length >= 4) {
      const slots = { matin: [5, 12], 'après-midi': [12, 18], soir: [18, 29] };
      const res = Object.entries(slots).map(([k, [a, b]]) => {
        const l = c.filter((x) => { let h = new Date(x.t).getHours(); if (h < 5) h += 24; return h >= a && h < b; });
        return { k, n: l.length, m: l.length ? l.reduce((t, x) => t + x.m, 0) / l.length : 0 };
      }).filter((x) => x.n >= 2).sort((x, y) => y.m - x.m);
      if (res.length >= 2) out.push(['🕐', `Tu te sens généralement mieux le <strong>${res[0].k}</strong> que le ${res[res.length - 1].k}.`]);
      const q = {}; c.forEach((x) => { const k = quadrant(x); q[k] = (q[k] || 0) + 1; });
      const top = Object.entries(q).sort((x, y) => y[1] - x[1])[0];
      out.push(['🧭', `Ton état le plus fréquent : <strong>${QUAD_LABEL[top[0]]}</strong> (${Math.round((top[1] / c.length) * 100)} % du temps).`]);
    }
    const done = state.sessions.filter((s) => s.after);
    if (done.length >= 3) {
      const ups = done.filter((s) => gainOf(s) > 0).length;
      out.push(['📈', `Tu te sens mieux après <strong>${Math.round((ups / done.length) * 100)} %</strong> de tes micro-actions.`]);
    }
    if (!out.length) out.push(['🌱', 'Encore quelques check-ins et Boussole commencera à repérer tes tendances.']);
    return `<div class="card"><h2>Ce que Boussole remarque</h2>${out.map(([e, t]) =>
      `<div class="insight" style="margin-bottom:10px"><div class="e">${e}</div><p style="margin:0">${t}</p></div>`).join('')}</div>`;
  }

  function journalCard() {
    if (!state.journal.length) return '';
    const items = state.journal.slice(-5).reverse().map((j) => `
      <div class="journal-item">${esc(j.text).replace(/\n/g, '<br>')}
        <small>${byId[j.actionId]?.emoji || ''} ${new Date(j.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</small></div>`).join('');
    return `<div class="card"><h2>Tes bons moments</h2>${items}</div>`;
  }

  // ---------------------------------------------------------------- Réglages
  function showSettings() {
    render(`
      <h1>Réglages</h1>
      <div class="card">
        <div class="setting"><span>Prénom</span>
          <input type="text" id="name" value="${esc(state.name)}" maxlength="30" style="max-width:180px;padding:10px"></div>
        <div class="setting"><span>Thème</span>
          <div class="seg" id="theme">${['auto', 'light', 'dark'].map((t) =>
            `<button data-t="${t}" class="${state.theme === t ? 'on' : ''}">${{ auto: 'Auto', light: 'Clair', dark: 'Sombre' }[t]}</button>`).join('')}</div></div>
      </div>
      <div class="card">
        <h2>Tes données</h2>
        <p class="small muted">Elles restent sur cet appareil. ${state.checkins.length} check-ins, ${state.sessions.length} séances, ${state.journal.length} notes.</p>
        <button class="btn ghost" id="export">Exporter (JSON)</button>
        <button class="btn ghost" id="reset" style="color:var(--bad)">Tout effacer</button>
      </div>
      <div class="card">
        <h2>Installer l'app</h2>
        <p class="small muted" style="margin:0">Sur iPhone : bouton Partager → « Sur l'écran d'accueil ».<br>
        Sur Android : menu ⋮ → « Installer l'application ». Elle marchera ensuite hors ligne.</p>
      </div>
      <p class="center small muted">Boussole ne remplace pas un professionnel de santé. En cas de détresse, appelle le 3114 (France, 24h/24).</p>`);
    document.getElementById('name').onchange = (e) => { state.name = e.target.value.trim(); save(); };
    document.querySelectorAll('#theme button').forEach((b) => b.onclick = () => {
      state.theme = b.dataset.t; save(); applyTheme(); showSettings();
    });
    document.getElementById('export').onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: 'boussole-donnees.json' });
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    document.getElementById('reset').onclick = () => {
      if (!confirm('Effacer toutes tes données ? Cette action est définitive.')) return;
      state = fresh(); save(); applyTheme(); showOnboarding();
    };
  }

  // ---------------------------------------------------------------- Navigation
  function go(tab) {
    if (!state.onboarded) return showOnboarding();
    tabbar.hidden = false;
    tabbar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    ({ today: showToday, progress: showProgress, settings: showSettings })[tab]();
  }
  tabbar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(b.dataset.tab); });

  applyTheme();
  go('today');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
