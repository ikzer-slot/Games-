'use strict';
/* ==========================================================================
   IA d'Ambrevale
   - Le Seigneur des Cendres : commandant ennemi qui analyse votre base,
     choisit le flanc le plus faible, compose des contre-armées et APPREND
     de chaque assaut (poids par type d'unité, sauvegardés).
   - L'Architecte : génère procéduralement les camps d'expédition.
   - L'Oracle : conseiller qui lit votre base et vous guide.
   ========================================================================== */
const AI = {
  layoutFromState() { return S.buildings.map(b => ({ type: b.type, lvl: b.lvl, x: b.x, y: b.y, upg: b.upg })); },

  /* ---------- analyse de la base ---------- */
  analyze(layout) {
    const B = new Battle('analysis', layout, {});
    const N = MAP_N, gG = new Float32Array(N * N), gA = new Float32Array(N * N);
    let groundDps = 0, airDps = 0, splashDps = 0, magicDps = 0, singleDps = 0, slowCover = 0;
    const counts = {};
    for (const e of B.buildings) {
      counts[e.type] = (counts[e.type] || 0) + 1;
      if (!e.atk || e.disabled) continue;
      const a = e.atk; const dps = a.aura ? a.dmg / a.rate + 25 : a.dmg / a.rate * (a.chain ? 1.6 : 1) * (a.splash ? 1.8 : 1);
      if (a.ground) groundDps += dps; if (a.air) airDps += dps;
      if (a.splash) splashDps += dps; if (a.magic) magicDps += dps; if (!a.splash && !a.aura && !a.chain) singleDps += dps;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (Math.hypot(x + 0.5 - e.cx, y + 0.5 - e.cy) <= a.range) { if (a.ground) gG[y * N + x] += dps; if (a.air) gA[y * N + x] += dps; if (a.aura) slowCover++; }
      }
    }
    const f = B.field('citadel'), pred = B.goalPred('citadel');
    const sides = [];
    for (let s = 0; s < 4; s++) {
      let best = null;
      for (let k = 3; k <= N - 4; k += 3) {
        const [sx, sy] = this.edgeCell(s, k);
        let x = sx, y = sy, exp = 0, walls = 0, steps = 0, breakT = 0;
        while (steps++ < 120) {
          const i = y * N + x; if (f[i] === 0) break;
          exp += gG[i];
          let bj = -1, bv = 1e12;
          for (const [dx, dy] of NB8) {
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            if (dx && dy && (B.blocked(x + dx, y) || B.blocked(x, y + dy))) continue;
            const j = ny * N + nx, v = (dx && dy ? 1.414 : 1) + B.extraCost(j, pred) + f[j];
            if (v < bv) { bv = v; bj = j; }
          }
          if (bj < 0) break;
          const nx = bj % N, ny = (bj / N) | 0, e = B.bAt(nx, ny);
          if (e && !pred(e)) { if (e.cat === 'wall') walls++; breakT += e.hp / 40; exp += gG[i] * Math.min(8, e.hp / 40); }
          x = nx; y = ny;
        }
        // trajectoire aérienne en ligne droite
        let air = 0; const cit = B.cit;
        for (let k2 = 0; k2 <= 20; k2++) { const ax = Math.floor(lerp(sx, cit.cx, k2 / 20)), ay = Math.floor(lerp(sy, cit.cy, k2 / 20)); air += gA[clamp(ay, 0, N - 1) * N + clamp(ax, 0, N - 1)] * 0.6; }
        const cand = { side: s, k, ground: exp, air, walls, breakT };
        if (!best || cand.ground < best.ground) best = cand;
      }
      sides.push(best);
    }
    const totalWalls = counts.wall || 0;
    return { sides, groundDps, airDps, splashDps, magicDps, singleDps, slowCover, counts, totalWalls, gG, gA };
  },
  edgeCell(s, k) { const N = MAP_N; return s === 0 ? [k, 0] : s === 1 ? [N - 1, k] : s === 2 ? [k, N - 1] : [0, k]; },
  spawnPos(s, k, air) {
    const N = MAP_N, j = rnd(-2.5, 2.5), o = air ? -1.5 : 0.5;
    const a = clamp(k + j, 1, N - 1);
    return s === 0 ? [a, o] : s === 1 ? [N - o, a] : s === 2 ? [a, N - o] : [o, a];
  },

  /* ---------- planification d'un assaut ---------- */
  plan() {
    const T = S.threat, an = this.analyze(this.layoutFromState());
    const lvl = clamp(1 + Math.floor((T - 1) / 3), 1, 8);
    const budget = Math.round(10 + T * 7 + T * T * 0.35);
    const avail = UNIT_ORDER.filter(k => UNITS[k].threat <= T);
    const tg = an.groundDps + 1, ta = an.airDps + 1;
    const splashShare = an.splashDps / tg, magicShare = an.magicDps / tg, singleShare = an.singleDps / tg;
    const noisy = an.sides.map(s => Object.assign({ r: s.ground * (0.9 + Math.random() * 0.2) + Math.random() * 3 }, s));
    const sorted = noisy.sort((a, b) => a.r - b.r);
    const weakest = sorted[0];
    const why = {};
    const score = {};
    for (const k of avail) {
      let c = 1;
      switch (k) {
        case 'marauder': c = 1; break;
        case 'scout': c = splashShare > 0.35 ? 0.35 : 1.1 + singleShare * 0.6; if (splashShare < 0.2) why.scout = 'peu de dégâts de zone : la nuée d\'éclaireurs passera'; break;
        case 'archerU': c = 0.8 + Math.min(1, an.totalWalls / 25); if (an.totalWalls > 12) why.archerU = 'vos murailles sont nombreuses : ses archères tireront par-dessus'; break;
        case 'sapper': c = weakest.walls >= 2 ? 1.2 + weakest.walls * 0.15 : 0.15; if (weakest.walls >= 2) why.sapper = `${weakest.walls} murailles bloquent le chemin : des sapeurs sont prévus`; break;
        case 'brute': c = 0.7 + singleShare * 1.3 - magicShare * 0.6; if (singleShare > 0.5) why.brute = 'vos défenses frappent sans magie : ses Colosses cuirassés encaisseront'; break;
        case 'shaman': c = 0.6 + Math.min(0.8, budget / 120); break;
        case 'wyvern': { const ratio = an.airDps / tg; c = 0.4 + (1 - ratio) * 2.2; if (ratio < 0.5) why.wyvern = 'votre défense aérienne est faible : des wyvernes arrivent'; break; }
      }
      score[k] = Math.max(0.05, c * (S.ai.w[k] || 1));
    }
    // composition (housing)
    const keys = avail.slice().sort((a, b) => score[b] - score[a]);
    const top = keys.slice(0, Math.min(keys.length, 2 + Math.floor(T / 3)));
    let sum = 0; for (const k of top) sum += Math.pow(score[k], 1.4);
    const comp = {};
    for (const k of top) {
      const share = Math.min(top.length > 1 ? 0.45 : 1, Math.pow(score[k], 1.4) / sum);
      comp[k] = Math.max(1, Math.round(budget * share / UNITS[k].housing));
    }
    let usedH = 0; for (const k in comp) usedH += comp[k] * UNITS[k].housing;
    if (budget - usedH >= 2) comp.marauder = (comp.marauder || 0) + Math.round((budget - usedH) * 0.8);
    if (!comp.marauder && avail.includes('marauder')) comp.marauder = 2;
    // vagues
    const order = []; for (const k in comp) for (let i = 0; i < comp[k]; i++) order.push(k);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const cuts = [0, Math.round(order.length * 0.3), Math.round(order.length * 0.65), order.length];
    const second = sorted[1];
    const waves = [0, 1, 2].map(w => {
      const list = order.slice(cuts[w], cuts[w + 1]).map((type, i) => {
        const pincer = w === 2 && T >= 5 && i % 2 === 1;
        const sd = pincer ? second : (w === 1 && T >= 3 ? (Math.random() < 0.5 ? weakest : second) : weakest);
        return { type, side: sd.side, k: sd.k };
      });
      return list;
    });
    if (T >= 4) waves[2].push({ type: avail.includes('brute') ? 'brute' : 'marauder', side: weakest.side, k: weakest.k, elite: true });
    // rapport
    const report = [];
    report.push(`Le Seigneur des Cendres a étudié votre royaume. Il frappera par le flanc <b>${SIDE_NAMES[weakest.side]}</b>, où vos défenses sont les plus faibles.`);
    if (T >= 5) report.push(`Une attaque en tenaille viendra aussi du flanc <b>${SIDE_NAMES[second.side]}</b> lors de la dernière vague.`);
    for (const k of top) if (why[k]) report.push(`Il a remarqué que ${why[k]}.`);
    const learned = Object.keys(S.ai.w).filter(k => avail.includes(k)).sort((a, b) => S.ai.w[b] - S.ai.w[a])[0];
    if (S.ai.history.length >= 2 && S.ai.w[learned] > 1.15) report.push(`Sa mémoire des combats passés lui souffle que ses <b>${UNITS[learned].name}s</b> vous font souffrir.`);
    if (T >= 4) report.push('Un <b>Champion</b> d\'élite mènera la dernière vague.');
    return { T, lvl, budget, comp, waves, report, sides: [weakest.side, second.side] };
  },

  /* ---------- apprentissage ---------- */
  learn(plan, battle, aiWon) {
    const perfs = []; for (const k in battle.perf) { const p = battle.perf[k]; perfs.push([k, p.dmg / Math.max(1, p.housing)]); }
    if (!perfs.length) return;
    const mean = perfs.reduce((a, b) => a + b[1], 0) / perfs.length || 1;
    for (const [k, v] of perfs) {
      let w = S.ai.w[k] || 1;
      w *= Math.exp(0.35 * clamp(v / mean - 1, -1, 1.5));
      if (aiWon) w *= 1.06;
      S.ai.w[k] = clamp(w, 0.4, 3);
    }
    S.ai.history.push({ T: plan.T, aiWon, comp: plan.comp, t: now() });
    if (S.ai.history.length > 12) S.ai.history.shift();
  },
  battleComment(battle, aiWon) {
    const perfs = Object.entries(battle.perf).map(([k, p]) => [k, p.dmg / Math.max(1, p.housing)]).sort((a, b) => b[1] - a[1]);
    if (!perfs.length) return '';
    const best = perfs[0][0], worst = perfs[perfs.length - 1][0];
    if (aiWon) return `« Vos murs ont cédé devant mes ${UNITS[best].name}s. Je reviendrai avec davantage. »`;
    return `« Mes ${UNITS[worst].name}s ont été inutiles… mais je retiens que mes ${UNITS[best].name}s ont fait mouche. »`;
  },

  /* ---------- l'Architecte : camps d'expédition ---------- */
  camp(n) {
    const rng = mulberry32(hashStr('camp-' + n));
    const N = MAP_N, occ = new Uint8Array(N * N), layout = [];
    const lvl = clamp(1 + Math.floor(n / 3), 1, 9);
    const styles = ['en anneau', 'compact', 'dispersé', 'en compartiments'];
    const style = n < 3 ? 'dispersé' : styles[Math.floor(rng() * styles.length)];
    const free = (x, y, s, gap) => { for (let yy = y - gap; yy < y + s + gap; yy++) for (let xx = x - gap; xx < x + s + gap; xx++) { if (xx < 2 || yy < 2 || xx >= N - 2 || yy >= N - 2) { if (xx >= x && xx < x + s && yy >= y && yy < y + s) return false; continue; } if (occ[yy * N + xx]) return false; } return true; };
    const put = (type, x, y, l) => { const s = BUILDINGS[type].size; for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) occ[yy * N + xx] = 1; layout.push({ type, lvl: l, x, y }); };
    const place = (type, l, rMin, rMax, cx, cy, gap) => {
      const s = BUILDINGS[type].size;
      for (let tries = 0; tries < 200; tries++) {
        const a = rng() * Math.PI * 2, grow = Math.floor(tries / 40), r = lerp(rMin + grow, rMax + grow * 1.5, rng());
        const x = Math.round(cx + Math.cos(a) * r - s / 2), y = Math.round(cy + Math.sin(a) * r - s / 2);
        if (x < 2 || y < 2 || x + s > N - 2 || y + s > N - 2) continue;
        if (free(x, y, s, gap)) { put(type, x, y, l); return true; }
      }
      return false;
    };
    const cx = 13 + Math.round((rng() - 0.5) * 4), cy = 13 + Math.round((rng() - 0.5) * 4);
    put('citadel', cx - 1, cy - 1, clamp(Math.ceil(n / 4), 1, 8));
    if (n < 3) layout[0].noAtk = true;
    const tight = style === 'compact' ? 0.7 : style === 'dispersé' ? 1.35 : 1;
    const nDef = Math.min(16, 1 + Math.floor(n * 0.7));
    const defTypes = ['archer']; if (n >= 3) defTypes.push('cannon'); if (n >= 5) defTypes.push('arcane'); if (n >= 8) defTypes.push('frost');
    for (let i = 0; i < nDef; i++) place(defTypes[i % defTypes.length], clamp(lvl - (rng() < 0.4 ? 1 : 0), 1, 9), 2.8 * tight, 5.5 * tight, cx, cy, 1);
    const res = ['goldmine', 'sapwell', 'goldvault', 'sapvault', 'goldmine', 'sapwell', 'barracks', 'camp'];
    const nRes = Math.min(res.length, 3 + Math.floor(n / 3));
    for (let i = 0; i < nRes; i++) place(res[i], clamp(lvl, 1, 9), 5.5 * tight, 9.5, cx, cy, 1);
    // murailles
    if (n >= 3) {
      const wl = clamp(lvl - 1, 1, 8);
      const ring = (r, gaps) => {
        for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
          if (x < 2 || y < 2 || x >= N - 2 || y >= N - 2 || occ[y * N + x]) continue;
          if (gaps && rng() < gaps) continue;
          put('wall', x, y, wl);
        }
      };
      const gaps = n < 6 ? 0.18 : n < 10 ? 0.05 : 0;
      if (style === 'en anneau' || style === 'compact' || style === 'dispersé') ring(style === 'compact' ? 3 : 4, gaps);
      if (style === 'en compartiments') {
        ring(4, gaps);
        for (let k = -3; k <= 3; k++) { if (!occ[cy * N + cx + k] && Math.abs(k) > 1) put('wall', cx + k, cy, wl); if (!occ[(cy + k) * N + cx] && Math.abs(k) > 1) put('wall', cx, cy + k, wl); }
      }
      if (n >= 10) ring(7, 0.1);
    }
    // butin réparti sur les bâtiments
    const gold = Math.round(250 + 260 * Math.pow(n, 1.35)), sap = Math.round(gold * 0.9);
    const loot = layout.filter(b => b.type !== 'wall');
    const weights = loot.map(b => b.type === 'citadel' ? 3 : BUILDINGS[b.type].cat === 'resource' ? 2.5 : 1);
    const ws = weights.reduce((a, b) => a + b, 0);
    loot.forEach((b, i) => { b.loot = { gold: gold * weights[i] / ws, sap: sap * weights[i] / ws }; });
    const A = ['Fort', 'Bastion', 'Repaire', 'Citadelle', 'Camp', 'Donjon', 'Avant-poste', 'Sanctuaire'];
    const Bn = ['des Brumes', 'de Cendre', 'du Corbeau', 'des Ronces', 'd\'Obsidienne', 'du Givre', 'des Ombres', 'de l\'Aube rouge', 'des Lames', 'du Marais'];
    const name = A[Math.floor(rng() * A.length)] + ' ' + Bn[Math.floor(rng() * Bn.length)];
    return { n, name, style, layout, gold, sap, lvl, nDef: layout.filter(b => BUILDINGS[b.type].atk && b.type !== 'citadel').length, walls: layout.filter(b => b.type === 'wall').length };
  },

  /* ---------- l'Oracle : conseils ---------- */
  advice() {
    const tips = [];
    const free = S.builders - buildersBusy();
    if (free > 0) tips.push({ ico: '🔨', t: `${free > 1 ? free + ' bâtisseurs sont inactifs' : 'Un bâtisseur est inactif'}. Lancez une amélioration avant de partir : elle avancera pendant votre absence.` });
    for (const r of ['gold', 'sap']) if (S.res[r] >= capacity(r) * 0.95) tips.push({ ico: '📦', t: `Vos réserves de ${r === 'gold' ? 'or' : 'sève'} sont pleines. Dépensez-les ou améliorez vos ${r === 'gold' ? "coffres d'or" : 'réservoirs'}.` });
    const full = S.buildings.filter(b => BUILDINGS[b.type].prod && b.buf >= BUILDINGS[b.type].cap(b.lvl) * 0.95);
    if (full.length) tips.push({ ico: '⛏️', t: `${full.length} producteur(s) débordent : récoltez-les, la production est à l'arrêt.` });
    const an = this.analyze(this.layoutFromState());
    const weakest = an.sides.slice().sort((a, b) => a.ground - b.ground)[0];
    const strongest = an.sides.slice().sort((a, b) => b.ground - a.ground)[0];
    if (strongest.ground > weakest.ground * 1.6) tips.push({ ico: '🛡️', t: `Votre flanc <b>${SIDE_NAMES[weakest.side]}</b> est le plus exposé. Le Seigneur des Cendres le sait : renforcez-le.` });
    if (S.threat >= 5 && an.airDps < an.groundDps * 0.5) tips.push({ ico: '🐉', t: 'Les wyvernes approchent du seuil de menace : vos canons ne peuvent pas les toucher. Misez sur les archers et les tours arcaniques.' });
    if ((an.counts.wall || 0) < 10 && CL() >= 2) tips.push({ ico: '🧱', t: 'Quelques murailles bien placées forcent l\'ennemi à rester sous le feu de vos tours. Construisez des couloirs !' });
    if (housingUsed() < housingCap() * 0.5) tips.push({ ico: '⚔️', t: 'Votre campement est à moitié vide. Entraînez des troupes : elles se forment pendant votre absence.' });
    if (S.horns.n >= HORN_MAX) tips.push({ ico: '📯', t: 'Vos cornes de guerre sont pleines : chaque assaut repoussé rapporte du butin et des cristaux.' });
    if (dailyAvailable()) tips.push({ ico: '🎁', t: 'Le coffre du jour vous attend ! Revenez chaque jour pour faire grimper votre série.' });
    const done = S.quests.list.filter(q => q.prog >= q.n && !q.claimed).length;
    if (done) tips.push({ ico: '📜', t: `${done} quête(s) terminée(s) à réclamer.` });
    if (!tips.length) tips.push({ ico: '✨', t: 'Tout est en ordre. Votre royaume prospère… pour l\'instant.' });
    return tips;
  }
};
