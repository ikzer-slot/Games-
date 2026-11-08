// Miel & Dards — simulation et rendu.
import { RADIUS, FLOWERS, DEFENSES, ENEMIES, COLONY, UPGRADE, SECTORS, hiveMaxBees, hiveMaxHp, hiveCap, hiveUpgradeCost } from './data.js';
import { DIRS, key, hexDist, toWorld, fromWorld, ring, sectorOf, sectorAngle } from './hex.js';
import { HornetChief, planColony } from './ai.js';
import { sfx } from './audio.js';

const SAVE_KEY = 'miel-et-dards-save-v1';
const BEST_KEY = 'miel-et-dards-best';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const HEXR = 0.5773503; // rayon d'un hexagone en unités monde

const sprites = new Map();
function emoji(e, px, dpr) {
  px = Math.max(6, Math.round(px));
  const k = e + px + '|' + dpr;
  let c = sprites.get(k);
  if (!c) {
    const S = Math.ceil(px * 1.4 * dpr);
    c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${px * dpr}px ${EMOJI_FONT}`;
    g.fillText(e, S / 2, S / 2 + px * dpr * 0.06);
    c.L = S / dpr; sprites.set(k, c);
    if (sprites.size > 500) sprites.delete(sprites.keys().next().value);
  }
  return c;
}

export class Game {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.listeners = {}; this.tool = null; this.speed = 1; this.paused = false;
    this.time = 0; this.selected = null;
    this.resetRuntime();
    this.bindInput();
  }
  on(n, f) { (this.listeners[n] ||= []).push(f); }
  emit(n, ...a) { (this.listeners[n] || []).forEach(f => f(...a)); }
  toast(m) { this.emit('toast', m); }

  resetRuntime() {
    this.enemies = []; this.foragers = []; this.guards = []; this.shots = [];
    this.particles = []; this.floaters = []; this.queue = []; this.spawnT = 0; this.syncT = 0; this.queenT = 0;
  }

  // ---------- Partie ----------
  newGame() {
    const tiles = [];
    for (let q = -RADIUS; q <= RADIUS; q++) for (let r = -RADIUS; r <= RADIUS; r++) {
      if (hexDist(q, r) > RADIUS) continue;
      tiles.push({ q, r, t: q === 0 && r === 0 ? 'hive' : 'g', flower: null, def: null });
    }
    this.s = {
      tiles, honey: 70, pollen: 12, bees: 12, hiveLvl: 1, hiveHp: hiveMaxHp(1),
      wave: 0, phase: 'build', timer: 60, warn: null,
      alloc: { f: 0.55, g: 0.25, n: 0.2 }, target: { f: 0.55, g: 0.25, n: 0.2 }, auto: false, queenWhy: '',
      stats: { kills: 0, honey: 0, born: 0, lost: 0 }, tutorial: 0,
    };
    this.chief = new HornetChief();
    this.indexTiles();
    // Rochers et mares aléatoires (sans couper l'accès à la ruche)
    const cand = this.s.tiles.filter(t => { const d = hexDist(t.q, t.r); return d >= 2 && d <= 3; });
    for (let i = 0; i < 6; i++) { const t = pick(cand); if (t.t === 'g') t.t = i < 4 ? 'rock' : 'water'; }
    this.computeFlow();
    if (!this.edgesReachable()) return this.newGame();
    // Fleurs de départ
    const near = this.s.tiles.filter(t => t.t === 'g' && hexDist(t.q, t.r) <= 2).sort(() => Math.random() - 0.5);
    ['daisy', 'daisy', 'tulip', 'daisy'].forEach((id, i) => near[i].flower = { id, g: 1, cd: 0 });
    this.resetRuntime(); this.buildTerrain(); this.emit('change');
  }

  indexTiles() {
    this.map = new Map();
    for (const t of this.s.tiles) { const w = toWorld(t.q, t.r); t.x = w.x; t.y = w.y; this.map.set(key(t.q, t.r), t); }
    this.hive = this.map.get('0,0');
  }
  forTiles(f) { for (const t of this.s.tiles) f(t); }
  tile(q, r) { return this.map.get(key(q, r)); }
  nb(t) { return DIRS.map(([dq, dr]) => this.tile(t.q + dq, t.r + dr)).filter(Boolean); }
  passable(t) { return t.t === 'hive' || (t.t === 'g' && !(t.def && DEFENSES[t.def.id].blocks)); }

  // Champ de flux : distance de chaque case à la ruche pour les ennemis au sol.
  computeFlow() {
    this.forTiles(t => t.dist = Infinity);
    this.hive.dist = 0;
    const q = [this.hive];
    while (q.length) {
      const c = q.shift();
      for (const n of this.nb(c)) if (n.dist === Infinity && this.passable(n)) { n.dist = c.dist + 1; q.push(n); }
    }
  }
  edgesReachable() { return this.s.tiles.every(t => hexDist(t.q, t.r) !== RADIUS || !this.passable(t) || t.dist < Infinity) && this.s.tiles.some(t => hexDist(t.q, t.r) === RADIUS && t.dist < Infinity); }

  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ s: this.s, chief: this.chief.toJSON() }, (k, v) => (k === 'res' || k === 'dist' || k === 'x' || k === 'y') ? undefined : v)); } catch { } }
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d?.s?.tiles) return false;
      this.s = d.s; this.chief = new HornetChief(d.chief);
      this.s.tiles.forEach(t => { if (t.flower) t.flower.res = null; });
      this.indexTiles(); this.computeFlow(); this.resetRuntime(); this.buildTerrain(); this.emit('change');
      return true;
    } catch { return false; }
  }
  best() { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } }

  // ---------- Économie ----------
  cap() { return hiveCap(this.s.hiveLvl); }
  maxBees() { return hiveMaxBees(this.s.hiveLvl); }
  addHoney(v) { const before = this.s.honey; this.s.honey = Math.min(this.cap(), this.s.honey + v); return this.s.honey - before; }
  spend(v) { if (this.s.honey < v) { sfx('error'); this.toast('Pas assez de miel 🍯'); return false; } this.s.honey -= v; return true; }
  upgradeHive() {
    const cost = hiveUpgradeCost(this.s.hiveLvl);
    if (!this.spend(cost)) return;
    this.s.hiveLvl++; this.s.hiveHp = Math.min(hiveMaxHp(this.s.hiveLvl), this.s.hiveHp + 15);
    this.puff(0, 0, '#ffd166', 24); sfx('build'); this.toast(`👑 Ruche niveau ${this.s.hiveLvl} : ${this.maxBees()} abeilles max`); this.emit('change');
  }
  setAlloc(f, g) {
    f = Math.max(0, Math.min(1, f)); g = Math.max(0, Math.min(1 - f, g));
    this.s.alloc = { f, g, n: Math.max(0, 1 - f - g) }; this.s.target = { ...this.s.alloc };
  }
  estimateThreat() {
    const s = this.s;
    let hp = 0;
    if (s.phase === 'wave') { for (const e of this.enemies) hp += e.hp; for (const q of this.queue) hp += ENEMIES[q.sp].hp * this.hpMul(s.wave); }
    else { const w = s.wave + 1; hp = this.waveSize(w) * 24 * this.hpMul(w) + (w % 5 === 0 ? 520 * this.hpMul(w) : 0); }
    return hp / 28;
  }
  hpMul(w) { return 1 + 0.15 * (w - 1); }
  waveSize(w) { return 3 + Math.round(1.8 * w); }

  // ---------- Actions ----------
  tap(t) {
    if (!t) return;
    const tool = this.tool;
    if (t.t === 'hive') { sfx('click'); return this.emit('hiveTap'); }
    if (t.def && tool?.kind !== 'shovel') { this.selected = t; sfx('click'); return this.emit('defTap', t); }
    if (tool?.kind === 'flower') return this.plant(t, tool.id);
    if (tool?.kind === 'def') return this.build(t, tool.id);
    if (tool?.kind === 'shovel') { if (t.flower) { t.flower = null; sfx('plant'); this.puff(t.x, t.y, '#8a5a3b', 6); } return; }
    if (t.flower) { const f = FLOWERS[t.flower.id]; this.toast(`${f.emoji} ${f.name} : ${t.flower.g < 1 ? Math.round(t.flower.g * 100) + ' % de croissance' : 'en fleur, prête à butiner'}`); }
    this.selected = null;
  }
  plant(t, id) {
    if (t.t !== 'g' || t.flower || t.def) return;
    if (!this.spend(FLOWERS[id].cost)) return;
    t.flower = { id, g: 0, cd: 0 };
    this.puff(t.x, t.y, '#7bc950', 8); sfx('plant');
    if (this.s.tutorial === 0) this.nextTutorial();
    this.emit('change');
  }
  build(t, id) {
    const d = DEFENSES[id];
    if (t.t !== 'g' || t.flower || t.def) return;
    if (d.blocks && this.enemies.some(e => !e.flying && Math.hypot(e.x - t.x, e.y - t.y) < 0.7)) { sfx('error'); return this.toast('Un ennemi est sur cette case'); }
    if (this.s.honey < d.cost) { sfx('error'); return this.toast('Pas assez de miel 🍯'); }
    t.def = { id, lvl: 0, cd: 0, spent: d.cost, honey: d.honey || 0 };
    if (d.blocks) {
      this.computeFlow();
      if (!this.edgesReachable()) { t.def = null; this.computeFlow(); sfx('error'); return this.toast('Impossible : ça bloquerait tout chemin vers la ruche'); }
    }
    this.s.honey -= d.cost;
    this.puff(t.x, t.y, '#e9c46a', 10); sfx('build');
    if (this.s.tutorial === 1 && id === 'jar') this.nextTutorial();
    this.emit('change');
  }
  upgradeCost(t) { return t.def.lvl >= 2 || t.def.id === 'lure' ? null : Math.round(DEFENSES[t.def.id].cost * UPGRADE[t.def.lvl + 1]); }
  upgrade(t) {
    const c = this.upgradeCost(t); if (c == null || !this.spend(c)) return;
    t.def.lvl++; t.def.spent += c; this.puff(t.x, t.y, '#fff3b0', 14); sfx('build'); this.emit('change');
  }
  refill(t) { if (t.def?.id !== 'lure') return; const need = 15 - t.def.honey; if (need > 0 && this.spend(need)) { t.def.honey = 15; sfx('honey'); this.emit('change'); } }
  sell(t) {
    if (!t.def) return;
    this.addHoney(Math.floor(t.def.spent * 0.6)); t.def = null; this.selected = null;
    this.computeFlow(); this.puff(t.x, t.y, '#e9c46a', 8); sfx('honey'); this.emit('change');
  }
  nextTutorial() { this.s.tutorial++; this.emit('tutorial', this.s.tutorial); }

  // ---------- Vagues ----------
  prepareWarn() { if (!this.s.warn) { this.s.warn = this.chief.choose(this.s.wave + 1); sfx('bee'); this.emit('change'); } }
  startWave() {
    const s = this.s; if (s.phase !== 'build') return;
    this.prepareWarn();
    const bonus = Math.floor(s.timer / 3);
    if (bonus > 2) { this.addHoney(bonus); this.toast(`Vague anticipée : +${bonus} 🍯`); }
    if (s.tutorial < 4) { s.tutorial = 4; this.emit('tutorial', 4); }
    s.wave++; s.phase = 'wave';
    const w = s.wave, n = this.waveSize(w), pool = Object.entries(ENEMIES).filter(([, e]) => !e.boss && e.from <= w).map(([k]) => k);
    this.queue = [];
    for (let i = 0; i < n; i++) {
      const sector = s.warn.second != null && Math.random() < 0.3 ? s.warn.second : s.warn.main;
      this.queue.push({ sp: pick(pool), sector });
    }
    if (w % 5 === 0) this.queue.push({ sp: 'bear', sector: s.warn.main });
    this.spawnInterval = Math.max(0.45, 1.1 - 0.04 * w); this.spawnT = 0.5;
    this.waveTotal = this.queue.length;
    sfx('wave'); this.emit('change');
  }
  endWave() {
    const s = this.s;
    const learned = this.chief.endWave();
    s.phase = 'build'; s.timer = 35; s.warn = null;
    const bonus = 8 + 2 * s.wave; this.addHoney(bonus);
    sfx('clear');
    this.emit('waveEnd', { wave: s.wave, bonus, learned });
    this.save(); this.emit('change');
  }
  spawn(q) {
    const s = this.s, base = ENEMIES[q.sp], mul = this.hpMul(s.wave);
    const edge = ring(RADIUS).map(h => this.tile(h.q, h.r)).filter(t => sectorOf(t.x, t.y) === q.sector && (base.flying || base.crusher || t.dist < Infinity));
    const t = pick(edge.length ? edge : ring(RADIUS).map(h => this.tile(h.q, h.r)).filter(t => t.dist < Infinity));
    const len = Math.hypot(t.x, t.y), k = (len + 1) / len;
    this.enemies.push({
      sp: q.sp, sector: q.sector, x: t.x * k, y: t.y * k, next: t, hp: base.hp * mul, max: base.hp * mul,
      speed: base.speed, flying: !!base.flying, armor: (base.armor || 0) + Math.floor(s.wave / 6),
      start: len + 1, slowT: 0, slowA: 0, stopT: 0, lure: null, lured: new Set(), atk: 0, wob: Math.random() * 7, flip: 1, flash: 0,
    });
  }

  // ---------- Boucle ----------
  update(dt) {
    if (this.paused || !this.s || this.s.phase === 'over') { this.fx(dt); return; }
    dt = Math.min(dt, 0.05) * this.speed;
    this.time += dt;
    const s = this.s;
    if (s.phase === 'build') {
      s.timer -= dt;
      if (s.timer <= 8) this.prepareWarn();
      if (s.timer <= 0) this.startWave();
    }
    this.colony(dt);
    this.forTiles(t => {
      const f = t.flower;
      if (f) { if (f.g < 1) f.g = Math.min(1, f.g + dt / FLOWERS[f.id].grow); else if (f.cd > 0) f.cd -= dt; }
    });
    if (s.phase === 'wave' && this.queue.length) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = this.spawnInterval * rand(0.6, 1.4); this.spawn(this.queue.shift()); }
    }
    this.updateEnemies(dt);
    this.updateDefenses(dt);
    this.updateBees(dt);
    this.fx(dt);
    if (s.phase === 'wave' && !this.queue.length && !this.enemies.length) this.endWave();
    this.hudT = (this.hudT || 0) + dt;
    if (this.hudT > 0.25) { this.hudT = 0; this.emit('tick'); }
  }

  colony(dt) {
    const s = this.s, C = COLONY;
    // La Reine IA ajuste la répartition
    if (s.auto) {
      this.queenT -= dt;
      if (this.queenT <= 0) { this.queenT = 3; const p = planColony(this); s.target = { f: p.f, g: p.g, n: p.n }; s.queenWhy = p.why; }
      const k = Math.min(1, dt * 0.8);
      for (const r of ['f', 'g', 'n']) s.alloc[r] += (s.target[r] - s.alloc[r]) * k;
    }
    // Consommation
    s.honey -= s.bees * C.eat * dt;
    if (s.honey < 0) {
      s.honey = 0; s.bees = Math.max(1, s.bees - 0.04 * dt);
      if (!this.starveWarned) { this.starveWarned = true; this.toast('⚠️ La colonie a faim ! Plante des fleurs ou envoie plus de butineuses.'); }
    } else this.starveWarned = false;
    // Nourrices
    const room = this.maxBees() - s.bees;
    if (room > 0) {
      let born = Math.min(room, s.bees * s.alloc.n * C.nurseRate * dt);
      born = Math.min(born, s.pollen / C.newBeePollen, s.honey / C.newBeeHoney);
      if (born > 0) { s.bees += born; s.pollen -= born * C.newBeePollen; s.honey -= born * C.newBeeHoney; s.stats.born += born; }
    }
    // Synchronise les abeilles visibles avec la répartition
    this.syncT -= dt;
    if (this.syncT <= 0) {
      this.syncT = 0.5;
      const n = Math.floor(s.bees), F = Math.round(n * s.alloc.f), G = Math.min(n - F, Math.round(n * s.alloc.g));
      while (this.foragers.length > F) { const i = this.foragers.findIndex(b => b.state === 'idle'); const b = this.foragers.splice(i >= 0 ? i : this.foragers.length - 1, 1)[0]; if (b.flower?.flower) b.flower.flower.res = null; }
      while (this.foragers.length < F) this.foragers.push({ x: rand(-0.15, 0.15), y: rand(-0.15, 0.15), state: 'idle', hp: 3, t: 0, ph: Math.random() * 6 });
      while (this.guards.length > G) this.guards.pop();
      while (this.guards.length < G) this.guards.push({ x: rand(-0.2, 0.2), y: rand(-0.2, 0.2), hp: C.guardHp, ang: Math.random() * 6, ph: Math.random() * 6 });
    }
  }

  killBee(list, b) {
    const i = list.indexOf(b); if (i < 0) return;
    list.splice(i, 1); this.s.bees = Math.max(0, this.s.bees - 1); this.s.stats.lost++;
    if (b.flower?.flower) b.flower.flower.res = null;
    this.puff(b.x, b.y, '#ffd166', 5);
  }

  updateBees(dt) {
    const s = this.s, C = COLONY;
    const move = (b, tx, ty, spd) => {
      const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
      if (d < 0.04) return true;
      const st = Math.min(d, spd * dt); b.x += dx / d * st; b.y += dy / d * st; if (Math.abs(dx) > 0.01) b.flip = dx < 0 ? -1 : 1;
      return false;
    };
    const danger = (t) => this.enemies.some(e => Math.hypot(e.x - t.x, e.y - t.y) < 1.3);
    for (const b of [...this.foragers]) {
      b.ph += dt * 30;
      if (b.state === 'idle') {
        let best = null, bs = 0;
        this.forTiles(t => {
          const f = t.flower; if (!f || f.g < 1 || f.cd > 0 || f.res || danger(t)) return;
          const d = FLOWERS[f.id], sc = (d.honey + d.pollen * 0.6) / (Math.hypot(t.x, t.y) + 1);
          if (sc > bs) { bs = sc; best = t; }
        });
        if (best) { b.flower = best; best.flower.res = b; b.state = 'go'; }
        else { b.t += dt; b.x = Math.cos(b.t * 2 + b.ph) * 0.18; b.y = Math.sin(b.t * 2 + b.ph) * 0.12 - 0.1; }
      } else if (b.state === 'go') {
        if (!b.flower.flower) { b.state = 'back'; continue; }
        if (move(b, b.flower.x + 0.05, b.flower.y - 0.1, C.beeSpeed)) { b.state = 'collect'; b.t = C.collectTime; }
      } else if (b.state === 'collect') {
        b.t -= dt;
        if (b.t <= 0) {
          const f = b.flower.flower;
          if (f) { const d = FLOWERS[f.id]; b.carry = { h: d.honey, p: d.pollen }; f.cd = d.cd; f.res = null; }
          b.state = 'back';
        }
      } else if (b.state === 'back') {
        if (move(b, 0, -0.05, C.beeSpeed)) {
          if (b.carry) {
            const got = this.addHoney(b.carry.h); s.pollen = Math.min(this.cap(), s.pollen + b.carry.p); s.stats.honey += got;
            if (Math.random() < 0.25) { this.floater(0.2, -0.3, '+🍯', '#ffd166', 0.7); sfx('honey'); }
            b.carry = null; this.hivePulse = 0.3;
          }
          b.state = 'idle'; b.flower = null;
        }
      }
    }
    // Gardiennes : réparties entre la ruche et les postes de garde
    const anchors = [{ x: 0, y: 0, r: 2.2 }];
    this.forTiles(t => { if (t.def?.id === 'post') anchors.push({ x: t.x, y: t.y, r: DEFENSES.post.range[t.def.lvl] }); });
    [...this.guards].forEach((b, i) => {
      if (!this.guards.includes(b)) return;
      b.ph += dt * 30;
      const a = anchors[i % anchors.length];
      if (b.target && (b.target.dead || Math.hypot(b.target.x - a.x, b.target.y - a.y) > a.r + 0.6)) b.target = null;
      if (!b.target) {
        let best = null, bd = a.r;
        for (const e of this.enemies) { const d = Math.hypot(e.x - a.x, e.y - a.y); if (d < bd) { bd = d; best = e; } }
        b.target = best;
      }
      if (b.target) {
        const e = b.target;
        if (move(b, e.x + Math.cos(b.ph * 0.1) * 0.15, e.y + Math.sin(b.ph * 0.1) * 0.15, 3.2) || Math.hypot(e.x - b.x, e.y - b.y) < 0.3) {
          this.hurt(e, C.guardDps * dt, true);
          if (!ENEMIES[e.sp].flying || ENEMIES[e.sp].hunter) { b.hp -= (ENEMIES[e.sp].hunter ? 1.6 : 0.8) * dt; if (b.hp <= 0) this.killBee(this.guards, b); }
        }
      } else {
        b.ang += dt * 1.6;
        const rad = anchors.length > 1 && a.x !== 0 ? 0.45 : 0.6 + (i % 3) * 0.15;
        move(b, a.x + Math.cos(b.ang) * rad, a.y + Math.sin(b.ang) * rad * 0.8, 2.4);
      }
    });
  }

  updateEnemies(dt) {
    const s = this.s;
    const poppies = [], lures = [];
    this.forTiles(t => {
      if (t.flower?.id === 'poppy' && t.flower.g >= 1) poppies.push(t);
      if (t.def?.id === 'lure' && t.def.honey > 0) lures.push(t);
    });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const base = ENEMIES[e.sp];
      e.flash = Math.max(0, e.flash - dt); e.wob += dt * 10;
      let slow = 0;
      for (const p of poppies) if (Math.hypot(p.x - e.x, p.y - e.y) < FLOWERS.poppy.aura) slow = Math.max(slow, FLOWERS.poppy.slow);
      if (e.slowT > 0) { e.slowT -= dt; slow = Math.max(slow, e.slowA); }
      e.slowed = slow > 0;
      const spd = e.speed * (1 - slow) * dt;
      const ox = e.x;

      // Les frelons chassent les abeilles à leur portée
      if (base.hunter) {
        e.atk -= dt;
        if (e.atk <= 0) {
          for (const list of [this.foragers, this.guards]) {
            const b = list.find(b => Math.hypot(b.x - e.x, b.y - e.y) < 0.45);
            if (b) { b.hp -= 2; e.atk = 1.5; if (b.hp <= 0) this.killBee(list, b); break; }
          }
        }
      }

      if (e.flying) {
        if (e.stopT > 0) {
          e.stopT -= dt;
          if (e.stopT <= 0 && e.lure?.def) { e.lure.def.honey -= 3; if (e.lure.def.honey <= 0) { this.toast('🍯 Un leurre est vide'); e.lure.def = null; } }
          continue;
        }
        let tx = 0, ty = 0;
        const lure = lures.find(l => l.def && !e.lured.has(l) && Math.hypot(l.x - e.x, l.y - e.y) < DEFENSES.lure.range[0]);
        if (lure) { tx = lure.x; ty = lure.y; }
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
        if (lure && d < 0.15) { e.lured.add(lure); e.lure = lure; e.stopT = 3; continue; }
        e.x += dx / d * spd + Math.cos(e.wob * 0.3) * 0.01; e.y += dy / d * spd + Math.sin(e.wob * 0.37) * 0.01;
      } else if (base.crusher) {
        const d = Math.hypot(e.x, e.y);
        e.x -= e.x / d * spd; e.y -= e.y / d * spd;
        const h = fromWorld(e.x, e.y), t = this.tile(h.q, h.r);
        if (t && (t.def || t.flower) && t.t !== 'hive') {
          const what = t.def ? DEFENSES[t.def.id].name : FLOWERS[t.flower.id].name;
          t.def = null; t.flower = null; this.computeFlow(); this.puff(t.x, t.y, '#8a5a3b', 14); this.shake = 0.2;
          this.floater(t.x, t.y - 0.3, `💥 ${what}`, '#ffb4a2');
        }
      } else {
        let t = e.next;
        if (!t || (!this.passable(t) && t.t !== 'hive')) {
          const h = fromWorld(e.x, e.y), cur = this.tile(h.q, h.r);
          t = cur && cur.dist < Infinity ? cur : this.nb(cur || this.hive).filter(n => n.dist < Infinity).sort((a, b) => a.dist - b.dist)[0];
          e.next = t;
        }
        const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
        if (d < 0.05 || d < spd) {
          e.x = t.x; e.y = t.y;
          const opts = this.nb(t).filter(n => n.dist < t.dist);
          if (opts.length) e.next = pick(opts);
        } else { e.x += dx / d * spd; e.y += dy / d * spd; }
      }
      if (Math.abs(e.x - ox) > 0.002) e.flip = e.x < ox ? -1 : 1;

      // Arrivée à la ruche
      if (Math.hypot(e.x, e.y) < 0.45) {
        e.dead = true;
        s.hiveHp -= base.dmg; const stolen = Math.min(s.honey, base.steal); s.honey -= stolen;
        this.chief.report(e.sector, 1 + stolen / 10);
        this.floater(0, -0.5, `-${base.dmg}❤️ -${Math.round(stolen)}🍯`, '#ff6b6b'); this.shake = 0.3; sfx('hurt');
        this.emit('change');
        if (s.hiveHp <= 0) { s.hiveHp = 0; return this.gameOver(); }
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);
  }

  hurt(e, dmg, dot = false) {
    if (e.dead) return;
    dmg = dot ? dmg * (1 - Math.min(0.6, e.armor * 0.1)) : Math.max(dmg * 0.3, dmg - e.armor);
    e.hp -= dmg; if (!dot) e.flash = 0.08;
    if (e.hp <= 0) {
      e.dead = true;
      const base = ENEMIES[e.sp];
      this.chief.report(e.sector, 0.5 * Math.max(0, 1 - Math.hypot(e.x, e.y) / e.start));
      this.addHoney(base.reward); this.s.stats.kills++;
      this.floater(e.x, e.y - 0.25, `+${base.reward}🍯`, '#ffd166', 1);
      this.puff(e.x, e.y, base.boss ? '#8d5524' : '#b5e48c', base.boss ? 26 : 9); sfx('kill');
      this.emit('change');
    }
  }

  updateDefenses(dt) {
    this.forTiles(t => {
      const d = t.def; if (!d) return;
      const def = DEFENSES[d.id];
      if (d.id === 'thistle') {
        for (const e of this.enemies) if (!e.flying && Math.hypot(e.x - t.x, e.y - t.y) < def.range[d.lvl]) this.hurt(e, def.dps[d.lvl] * dt, true);
      } else if (d.id === 'jar') {
        d.cd -= dt; if (d.cd > 0) return;
        let best = null, bd = Infinity;
        for (const e of this.enemies) {
          if (Math.hypot(e.x - t.x, e.y - t.y) > def.range[d.lvl]) continue;
          const h = Math.hypot(e.x, e.y); if (h < bd) { bd = h; best = e; }
        }
        if (!best) return;
        d.cd = def.rate[d.lvl]; d.ang = Math.atan2(best.y - t.y, best.x - t.x);
        this.shots.push({ x: t.x, y: t.y - 0.15, target: best, dmg: def.dmg[d.lvl] });
        sfx('shoot');
      }
    });
    for (const p of this.shots) {
      const e = p.target; if (e.dead) { p.done = true; continue; }
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d < 0.15) { p.done = true; this.hurt(e, p.dmg); e.slowT = 1.5; e.slowA = Math.max(e.slowA || 0, DEFENSES.jar.slow); this.puff(e.x, e.y, '#c77d2a', 5); sfx('hit'); continue; }
      p.x += dx / d * 6 * dt; p.y += dy / d * 6 * dt;
    }
    this.shots = this.shots.filter(p => !p.done);
  }

  fx(dt) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floaters) { f.y -= dt * 0.6; f.life -= dt; }
    this.floaters = this.floaters.filter(f => f.life > 0);
    if (this.shake) this.shake = Math.max(0, this.shake - dt);
    if (this.hivePulse) this.hivePulse = Math.max(0, this.hivePulse - dt);
  }
  puff(x, y, color, n) {
    for (let i = 0; i < n; i++) { const a = rand(0, 7), v = rand(0.3, 1.5); this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.3, life: 0.5, max: 0.5, color, size: rand(0.03, 0.07) }); }
  }
  floater(x, y, text, color, life = 1.2) { this.floaters.push({ x, y, text, color, life }); }

  gameOver() {
    const s = this.s; s.phase = 'over';
    const waves = s.wave - 1;
    let best = this.best(); if (waves > best) { best = waves; try { localStorage.setItem(BEST_KEY, best); } catch { } }
    try { localStorage.removeItem(SAVE_KEY); } catch { }
    this.emit('gameOver', { waves, best, stats: s.stats });
  }

  // ---------- Entrées ----------
  bindInput() {
    this.cv.addEventListener('pointerdown', (ev) => {
      if (!this.s || this.s.phase === 'over' || this.paused) return;
      const r = this.cv.getBoundingClientRect();
      const x = (ev.clientX - r.left - this.cx) / this.U, y = (ev.clientY - r.top - this.cy) / this.U;
      const h = fromWorld(x, y);
      this.tap(this.tile(h.q, h.r));
    });
  }

  // ---------- Rendu ----------
  resize() {
    const dpr = this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const r = this.cv.parentElement.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    const w = 2 * RADIUS + 1 + 0.8, h = 2 * RADIUS * 0.866 + 2 * HEXR + 1.8;
    this.U = Math.min(this.W / w, this.H / h);
    this.cx = this.W / 2; this.cy = this.H / 2;
    if (this.s) this.buildTerrain();
  }

  hexPath(g, x, y, rad) {
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = (60 * i - 30) * Math.PI / 180; const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath();
  }

  buildTerrain() {
    if (!this.U) return;
    const U = this.U, dpr = this.dpr;
    const off = this.terrain || (this.terrain = document.createElement('canvas'));
    off.width = Math.round(this.W * dpr); off.height = Math.round(this.H * dpr);
    const g = off.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createRadialGradient(this.cx, this.cy, U, this.cx, this.cy, Math.max(this.W, this.H) * 0.7);
    bg.addColorStop(0, '#d8eeb0'); bg.addColorStop(1, '#8fbf6a');
    g.fillStyle = bg; g.fillRect(0, 0, this.W, this.H);
    // herbes décoratives hors carte
    let seed = 3; const sr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) {
      const x = sr() * this.W, y = sr() * this.H;
      if (Math.hypot(x - this.cx, y - this.cy) < (RADIUS + 0.6) * U) continue;
      g.strokeStyle = 'rgba(70,120,50,0.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - U * 0.18); g.moveTo(x + 3, y); g.lineTo(x + 4, y - U * 0.14); g.stroke();
    }
    g.translate(this.cx, this.cy);
    const R = HEXR * U;
    for (const t of this.s.tiles) {
      const x = t.x * U, y = t.y * U;
      const top = t.t === 'water' ? '#6cc3e8' : t.t === 'rock' ? '#b7b0a2' : t.t === 'hive' ? '#f2c14e' : ((t.q * 7 + t.r * 3) & 1 ? '#a9d97a' : '#b3df84');
      const side = t.t === 'water' ? '#3f8fb8' : t.t === 'rock' ? '#857e72' : t.t === 'hive' ? '#c48a1c' : '#77a94e';
      g.fillStyle = side; this.hexPath(g, x, y + U * 0.09, R * 0.95); g.fill();
      g.fillStyle = top; this.hexPath(g, x, y, R * 0.95); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; this.hexPath(g, x, y, R * 0.9); g.stroke();
      if (t.t === 'g' && sr() < 0.5) { g.fillStyle = 'rgba(80,140,50,0.35)'; for (let k = 0; k < 3; k++) g.fillRect(x + (sr() - 0.5) * R, y + (sr() - 0.5) * R, 1.5, U * 0.08); }
      if (t.t === 'rock') {
        g.fillStyle = '#9a9387'; g.beginPath(); g.ellipse(x, y + U * 0.05, R * 0.55, R * 0.38, 0, 0, 7); g.fill();
        g.fillStyle = '#cfc8ba'; g.beginPath(); g.ellipse(x - R * 0.12, y - U * 0.02, R * 0.3, R * 0.18, -0.3, 0, 7); g.fill();
      }
      if (t.t === 'water') { g.fillStyle = '#4caf6a'; g.beginPath(); g.ellipse(x + R * 0.35, y + R * 0.25, R * 0.2, R * 0.12, 0.4, 0, 7); g.fill(); }
    }
  }

  drawBee(c, x, y, s, flip, ph, guard) {
    const U = this.U, k = s * U;
    c.save(); c.translate(x * U, y * U); c.scale(flip, 1);
    const w = Math.abs(Math.sin(ph)) * 0.6 + 0.4;
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.ellipse(-k * 0.15, -k * 0.55, k * 0.45, k * 0.28 * w, -0.4, 0, 7); c.fill();
    c.beginPath(); c.ellipse(k * 0.2, -k * 0.55, k * 0.4, k * 0.25 * w, 0.4, 0, 7); c.fill();
    c.fillStyle = guard ? '#ff9f1c' : '#ffd23f';
    c.beginPath(); c.ellipse(0, 0, k * 0.75, k * 0.5, 0, 0, 7); c.fill();
    c.fillStyle = '#2b2118';
    c.fillRect(-k * 0.2, -k * 0.48, k * 0.18, k * 0.96); c.fillRect(-k * 0.55, -k * 0.38, k * 0.14, k * 0.76);
    c.beginPath(); c.arc(k * 0.62, -k * 0.05, k * 0.28, 0, 7); c.fill();
    if (guard) { c.fillStyle = '#c1121f'; c.beginPath(); c.moveTo(-k * 0.75, 0); c.lineTo(-k * 1.05, k * 0.08); c.lineTo(-k * 0.75, k * 0.16); c.fill(); }
    c.restore();
  }
  drawHornet(c, x, y, flip, ph) {
    const U = this.U, k = 0.3 * U;
    c.save(); c.translate(x * U, y * U); c.scale(flip, 1);
    const w = Math.abs(Math.sin(ph * 3)) * 0.6 + 0.4;
    c.fillStyle = 'rgba(230,230,255,0.7)';
    c.beginPath(); c.ellipse(-k * 0.1, -k * 0.5, k * 0.55, k * 0.22 * w, -0.5, 0, 7); c.fill();
    c.beginPath(); c.ellipse(k * 0.2, -k * 0.5, k * 0.5, k * 0.2 * w, 0.3, 0, 7); c.fill();
    c.fillStyle = '#e07a1f'; c.beginPath(); c.ellipse(-k * 0.35, k * 0.05, k * 0.55, k * 0.33, 0.15, 0, 7); c.fill();
    c.fillStyle = '#3a1f0f'; for (let i = 0; i < 3; i++) c.fillRect(-k * (0.65 - i * 0.25), -k * 0.28, k * 0.1, k * 0.62);
    c.fillStyle = '#5a2e12'; c.beginPath(); c.ellipse(k * 0.25, -k * 0.02, k * 0.3, k * 0.24, 0, 0, 7); c.fill();
    c.fillStyle = '#f4a259'; c.beginPath(); c.arc(k * 0.6, -k * 0.05, k * 0.22, 0, 7); c.fill();
    c.fillStyle = '#d00000'; c.beginPath(); c.arc(k * 0.7, -k * 0.1, k * 0.07, 0, 7); c.fill();
    c.restore();
  }

  render() {
    const c = this.ctx, U = this.U, dpr = this.dpr, s = this.s, tm = this.time;
    if (!s || !this.terrain) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.terrain, 0, 0);
    let sx = 0, sy = 0; if (this.shake) { sx = rand(-1, 1) * this.shake * 10; sy = rand(-1, 1) * this.shake * 10; }
    c.setTransform(dpr, 0, 0, dpr, (this.cx + sx) * dpr, (this.cy + sy) * dpr);
    const spr = (e, px, x, y, flip = 1, a = 1) => {
      const sp = emoji(e, px, dpr), L = sp.L; c.globalAlpha = a;
      if (flip < 0) { c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(sp, -L / 2, -L / 2, L, L); c.restore(); }
      else c.drawImage(sp, x - L / 2, y - L / 2, L, L);
      c.globalAlpha = 1;
    };
    const R = HEXR * U;

    // Avertissement : côté choisi par le Frelon chef
    if (s.warn && s.phase === 'build') {
      const pulse = 0.45 + 0.35 * Math.sin(tm * 6);
      for (const [sec, a] of [[s.warn.main, pulse], [s.warn.second, pulse * 0.5]]) {
        if (sec == null) continue;
        const mid = sectorAngle(sec), rad = (RADIUS + 0.75) * U;
        c.strokeStyle = `rgba(214,40,40,${a})`; c.lineWidth = U * 0.28; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, rad, mid - 0.45, mid + 0.45); c.stroke();
        spr('⚠️', U * 0.45, Math.cos(mid) * rad, Math.sin(mid) * rad);
      }
    }
    // Eau animée
    for (const t of s.tiles) if (t.t === 'water') {
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5; const o = Math.sin(tm * 2 + t.q) * R * 0.15;
      c.beginPath(); c.moveTo(t.x * U - R * 0.3 + o, t.y * U - R * 0.2); c.lineTo(t.x * U + o, t.y * U - R * 0.2); c.stroke();
    }
    // Cases disponibles
    if (this.tool && this.tool.kind !== 'shovel') {
      c.fillStyle = `rgba(255,255,255,${0.2 + 0.12 * Math.sin(tm * 5)})`;
      for (const t of s.tiles) if (t.t === 'g' && !t.flower && !t.def) { this.hexPath(c, t.x * U, t.y * U, R * 0.8); c.fill(); }
    }
    // Auras de pavot
    for (const t of s.tiles) if (t.flower?.id === 'poppy' && t.flower.g >= 1) {
      c.fillStyle = 'rgba(180,120,220,0.12)'; c.beginPath(); c.arc(t.x * U, t.y * U, FLOWERS.poppy.aura * U, 0, 7); c.fill();
    }
    // Ruche (paille tressée)
    {
      const p = 1 + (this.hivePulse || 0) * 0.15, k = U * 0.55 * p;
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(0, k * 0.55, k * 1.05, k * 0.25, 0, 0, 7); c.fill();
      for (let i = 0; i < 5; i++) {
        const yy = k * 0.45 - i * k * 0.32, ww = k * (1 - i * 0.16);
        c.fillStyle = i % 2 ? '#e0a526' : '#f2bf3c';
        c.beginPath(); c.ellipse(0, yy, ww, k * 0.22, 0, 0, 7); c.fill();
        c.strokeStyle = '#b07812'; c.lineWidth = 1; c.stroke();
      }
      c.fillStyle = '#4a2c0a'; c.beginPath(); c.ellipse(0, k * 0.35, k * 0.18, k * 0.12, 0, 0, 7); c.fill();
      const hp = s.hiveHp / hiveMaxHp(s.hiveLvl);
      c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = U * 0.07; c.beginPath(); c.arc(0, 0, U * 0.78, 0, 7); c.stroke();
      c.strokeStyle = hp > 0.5 ? '#52b788' : hp > 0.25 ? '#f4a261' : '#e63946';
      c.beginPath(); c.arc(0, 0, U * 0.78, -Math.PI / 2, -Math.PI / 2 + hp * Math.PI * 2); c.stroke();
      spr('👑', U * 0.3, 0, -k * 1.15 + Math.sin(tm * 2) * 2);
    }
    // Fleurs et défenses (triées par y pour la profondeur)
    const items = s.tiles.filter(t => t.flower || t.def).sort((a, b) => a.y - b.y);
    for (const t of items) {
      const x = t.x * U, y = t.y * U;
      if (t.flower) {
        const f = t.flower, d = FLOWERS[f.id];
        c.strokeStyle = '#4f772d'; c.lineWidth = Math.max(1.5, U * 0.04);
        c.beginPath(); c.moveTo(x, y + R * 0.45); c.lineTo(x, y - R * 0.1 * f.g); c.stroke();
        if (f.g < 1) {
          c.fillStyle = '#6a994e'; c.beginPath(); c.ellipse(x - R * 0.15, y + R * 0.2, R * 0.18, R * 0.08, -0.5, 0, 7); c.ellipse(x + R * 0.15, y + R * 0.15, R * 0.18, R * 0.08, 0.5, 0, 7); c.fill();
          if (f.g > 0.4) spr(d.emoji, U * 0.25 + U * 0.3 * f.g, x, y - R * 0.15, 1, 0.5 + f.g * 0.5);
          c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2.5; c.beginPath(); c.arc(x + R * 0.5, y + R * 0.4, R * 0.18, -Math.PI / 2, -Math.PI / 2 + f.g * 6.283); c.stroke();
        } else {
          const sway = Math.sin(tm * 2 + t.q) * 2;
          spr(d.emoji, U * 0.62, x + sway, y - R * 0.25, 1, f.cd > 0 ? 0.7 : 1);
          if (f.cd <= 0 && !f.res && Math.sin(tm * 3 + t.r) > 0.6) spr('✨', U * 0.22, x + R * 0.4, y - R * 0.6);
        }
      }
      if (t.def) {
        const d = t.def, def = DEFENSES[d.id];
        c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x, y + R * 0.4, R * 0.55, R * 0.18, 0, 0, 7); c.fill();
        if (d.id === 'jar') {
          c.fillStyle = '#b5651d'; c.beginPath(); c.ellipse(x, y, R * 0.45, R * 0.5, 0, 0, 7); c.fill();
          c.fillStyle = '#d4884a'; c.beginPath(); c.ellipse(x - R * 0.12, y - R * 0.12, R * 0.15, R * 0.22, 0, 0, 7); c.fill();
          c.fillStyle = '#8a4b14'; c.fillRect(x - R * 0.2, y - R * 0.62, R * 0.4, R * 0.18);
          c.fillStyle = '#e9a23b'; c.beginPath(); c.arc(x, y - R * 0.58, R * 0.14 + Math.sin(tm * 4) * 1, 0, 7); c.fill();
        } else spr(def.emoji, U * 0.66, x, y - R * 0.15);
        if (d.id === 'lure') { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x - R * 0.4, y + R * 0.45, R * 0.8, 4); c.fillStyle = '#ffb703'; c.fillRect(x - R * 0.4, y + R * 0.45, R * 0.8 * d.honey / 15, 4); }
        for (let i = 0; i < d.lvl; i++) spr('⭐', U * 0.18, x - R * 0.2 + i * R * 0.4, y + R * 0.55);
      }
    }
    // Rayon de la défense sélectionnée
    if (this.selected?.def) {
      const t = this.selected, r = DEFENSES[t.def.id].range[t.def.lvl];
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2; c.setLineDash([6, 6]);
      c.beginPath(); c.arc(t.x * U, t.y * U, r * U, 0, 7); c.fill(); c.stroke(); c.setLineDash([]);
    } else this.selected = null;

    // Ennemis
    for (const e of this.enemies.filter(e => !e.flying).concat(this.enemies.filter(e => e.flying))) {
      const base = ENEMIES[e.sp], x = e.x * U, y = e.y * U - (e.flying ? U * 0.25 : 0);
      const size = U * (base.boss ? 0.95 : 0.5);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x, e.y * U + size * 0.3, size * 0.32, size * 0.1, 0, 0, 7); c.fill();
      if (e.slowed) { c.strokeStyle = 'rgba(190,140,255,0.8)'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, e.y * U + size * 0.3, size * 0.42, size * 0.14, 0, 0, 7); c.stroke(); }
      const bob = Math.sin(e.wob) * U * 0.03;
      if (base.emoji) spr(base.emoji, size, x, y + bob, -e.flip, 1);
      else this.drawHornet(c, e.x, e.y - 0.25 + bob / U, e.flip, e.wob);
      if (e.flash > 0) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x, y, size * 0.35, 0, 7); c.fill(); }
      if (e.stopT > 0) spr('😋', U * 0.25, x + size * 0.4, y - size * 0.4);
      if (e.hp < e.max) {
        const w = Math.max(size * 0.8, U * 0.4), h = Math.max(3, U * 0.06);
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x - w / 2, y - size * 0.62, w, h);
        c.fillStyle = base.boss ? '#e63946' : '#80ed99'; c.fillRect(x - w / 2, y - size * 0.62, w * Math.max(0, e.hp / e.max), h);
      }
    }
    // Projectiles de propolis
    for (const p of this.shots) { c.fillStyle = '#c77d2a'; c.beginPath(); c.arc(p.x * U, p.y * U, U * 0.07, 0, 7); c.fill(); c.fillStyle = '#f2b45a'; c.beginPath(); c.arc(p.x * U - 1, p.y * U - 1, U * 0.03, 0, 7); c.fill(); }
    // Abeilles
    for (const b of this.foragers) {
      if (b.state === 'idle' && Math.hypot(b.x, b.y) < 0.3) continue; // à l'intérieur de la ruche
      this.drawBee(c, b.x, b.y - 0.12, 0.18, b.flip || 1, b.ph, false);
      if (b.carry) { c.fillStyle = '#ffb703'; c.beginPath(); c.arc(b.x * U, (b.y - 0.05) * U, U * 0.035, 0, 7); c.fill(); }
    }
    for (const b of this.guards) this.drawBee(c, b.x, b.y - 0.12, 0.21, b.flip || 1, b.ph, true);
    // Particules
    for (const p of this.particles) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.color; c.beginPath(); c.arc(p.x * U, p.y * U, p.size * U, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    // Teinte crépuscule pendant les vagues
    if (s.phase === 'wave') { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = 'rgba(150,50,20,0.08)'; c.fillRect(0, 0, this.W, this.H); c.setTransform(dpr, 0, 0, dpr, (this.cx + sx) * dpr, (this.cy + sy) * dpr); }
    // Textes flottants
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${Math.round(U * 0.3)}px system-ui, sans-serif, ${EMOJI_FONT}`;
    for (const f of this.floaters) {
      c.globalAlpha = Math.min(1, f.life * 1.5); c.lineWidth = 3; c.strokeStyle = 'rgba(40,20,0,0.6)';
      c.strokeText(f.text, f.x * U, f.y * U); c.fillStyle = f.color; c.fillText(f.text, f.x * U, f.y * U);
    }
    c.globalAlpha = 1;
  }
}
