// Cœur du jeu : état, simulation (ferme, défense, gestion, IA) et rendu canvas.
import { COLS, ROWS, CROPS, TOWERS, ENEMIES, ITEMS, ITEM_KEYS, UPGRADE_MULT, VILLAGERS, MARKET_EVENTS } from './data.js';
import { generateMap, neighbors } from './map.js';
import { Swarm } from './swarm.js';
import { sfx } from './audio.js';

const SAVE_KEY = 'potager-gardien-save-v1';
const BEST_KEY = 'potager-gardien-best';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------- Cache d'emojis pré-rendus (performances mobiles) ----------
const emojiCache = new Map();
function emojiSprite(e, px, dpr) {
  px = Math.max(6, Math.round(px));
  const key = e + '|' + px + '|' + dpr;
  let cv = emojiCache.get(key);
  if (!cv) {
    const S = Math.ceil(px * 1.4 * dpr);
    cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `${px * dpr}px ${EMOJI_FONT}`;
    c.fillText(e, S / 2, S / 2 + px * dpr * 0.06);
    cv.logical = S / dpr;
    emojiCache.set(key, cv);
    if (emojiCache.size > 600) emojiCache.delete(emojiCache.keys().next().value);
  }
  return cv;
}

export class Game {
  constructor(canvas, settings) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.settings = settings;
    this.listeners = {};
    this.tool = null;
    this.speed = 1;
    this.paused = false;
    this.selected = null;
    this.time = 0;
    this.nightAlpha = 0;
    this.lastTip = null;
    this.resetRuntime();
    this.bindInput();
  }

  // ---------- Événements ----------
  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, ...a) { (this.listeners[name] || []).forEach(f => f(...a)); }
  toast(msg) { this.emit('toast', msg); }

  resetRuntime() {
    this.enemies = []; this.projectiles = []; this.particles = []; this.floaters = [];
    this.spawnQueue = []; this.spawnTimer = 0;
  }

  // ---------- Nouvelle partie / chargement ----------
  newGame() {
    const { grid, path } = generateMap();
    this.s = {
      coins: 70, hearts: 20, maxHearts: 20, rep: 0, day: 1, phase: 'day', dayTime: 0, dayLen: 80,
      grid, path, stock: { carrot: 0, seed: 24, pepper: 4, pumpkin: 2 }, capLvl: 0,
      market: { mult: { carrot: 1, seed: 1, pepper: 1, pumpkin: 1 }, event: null },
      orders: [], robots: [], autoReplant: true,
      stats: { kills: 0, harvest: 0, earned: 0, eaten: 0 }, tutorial: 0, nextOrderId: 1,
    };
    this.swarm = new Swarm();
    this.resetRuntime();
    this.seedStartingCrops();
    this.buildTerrain();
    this.startDay(true);
  }

  seedStartingCrops() {
    // Quelques carottes déjà mûres près de la grange pour la première récolte.
    const end = this.s.path[this.s.path.length - 1];
    const spots = [];
    this.forCells((cell, r, c) => {
      if (cell.t === 'g' && !this.isNearPath(r, c)) spots.push({ r, c, d: Math.hypot(r - end.r, c - end.c) });
    });
    spots.sort((a, b) => a.d - b.d);
    spots.slice(0, 3).forEach(p => this.s.grid[p.r][p.c].crop = { id: 'carrot', g: 1 });
    spots.slice(3, 5).forEach(p => this.s.grid[p.r][p.c].crop = { id: 'sunflower', g: 0.5 });
  }

  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ s: this.s, swarm: this.swarm.toJSON() })); } catch { }
  }
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      this.s = d.s; this.swarm = new Swarm(d.swarm);
      this.s.phase = 'day';
      this.resetRuntime(); this.buildTerrain();
      this.emit('change');
      return true;
    } catch { return false; }
  }
  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { } }
  best() { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } }

  // ---------- Utilitaires grille ----------
  forCells(fn) { const g = this.s.grid; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) fn(g[r][c], r, c); }
  cell(r, c) { return this.s.grid[r]?.[c]; }
  isNearPath(r, c) { return neighbors(this.s.grid, r, c).some(n => n.cell.t === 'p' || n.cell.t === 'b'); }
  nearWater(r, c) { return neighbors(this.s.grid, r, c, true).some(n => n.cell.t === 'w'); }
  isGuarded(r, c) {
    let g = false;
    this.forCells((cell, rr, cc) => {
      if (cell.tower?.id === 'scarecrow' && Math.hypot(rr - r, cc - c) <= TOWERS.scarecrow.range[cell.tower.lvl] + 0.3) g = true;
    });
    return g;
  }
  cap() { return 40 + this.s.capLvl * 30; }

  // ---------- Marché ----------
  mult(k) { return this.s.market.mult[k]; }
  targetMult(k) { const e = this.s.market.event; return e && e.item === k ? e.mod : 1; }
  price(k) { return Math.max(1, ITEMS[k].base * this.mult(k) * (1 + this.s.rep * 0.02)); }
  buyPrice(k) { return Math.ceil(this.price(k) * 1.5); }
  sell(k, n) {
    n = Math.min(n, this.s.stock[k]); if (n <= 0) return sfx('error');
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += this.price(k);
      this.s.market.mult[k] = Math.max(0.35, this.s.market.mult[k] - 0.025);
    }
    total = Math.round(total);
    this.s.stock[k] -= n; this.s.coins += total; this.s.stats.earned += total;
    sfx('coin'); this.toast(`Vendu ${n} ${ITEMS[k].emoji} pour ${total} 🪙`); this.emit('change');
  }
  buy(k, n) {
    const room = this.cap() - this.s.stock[k];
    n = Math.min(n, room);
    if (n <= 0) { sfx('error'); return this.toast('Silo plein pour cet article'); }
    const cost = this.buyPrice(k) * n;
    if (this.s.coins < cost) { sfx('error'); return this.toast('Pas assez de pièces'); }
    this.s.coins -= cost; this.s.stock[k] += n;
    this.s.market.mult[k] = Math.min(2.5, this.s.market.mult[k] + 0.02 * n);
    sfx('coin'); this.emit('change');
  }
  upgradeSilo() {
    const cost = 60 * (this.s.capLvl + 1);
    if (this.s.coins < cost) { sfx('error'); return this.toast('Pas assez de pièces'); }
    this.s.coins -= cost; this.s.capLvl++; sfx('build'); this.toast(`Silo agrandi : ${this.cap()} par article`); this.emit('change');
  }
  siloCost() { return 60 * (this.s.capLvl + 1); }

  // ---------- Commandes des villageois ----------
  genOrders() {
    const s = this.s;
    const pool = ['carrot', 'carrot', 'seed'];
    if (s.day >= 2) pool.push('pepper');
    if (s.day >= 3) pool.push('pumpkin', 'pumpkin');
    let add = s.day === 1 ? 1 : 2;
    while (s.orders.length < 3 && add-- > 0) {
      const item = pick(pool);
      const q = { carrot: [4, 10], seed: [10, 25], pepper: [3, 8], pumpkin: [1, 3] }[item];
      const qty = ri(q[0], q[1] + Math.floor(s.day / 3));
      const v = pick(VILLAGERS);
      s.orders.push({
        id: s.nextOrderId++, who: v.who, emoji: v.emoji, item, qty,
        reward: Math.ceil(qty * ITEMS[item].base * 1.7 * (1 + s.rep * 0.05)) + 5,
        deadline: s.day + 2,
      });
    }
  }
  deliver(id) {
    const s = this.s, o = s.orders.find(o => o.id === id);
    if (!o || s.stock[o.item] < o.qty) { sfx('error'); return this.toast('Stock insuffisant'); }
    s.stock[o.item] -= o.qty; s.coins += o.reward; s.stats.earned += o.reward; s.rep++;
    s.orders = s.orders.filter(x => x !== o);
    sfx('coin'); this.toast(`${o.emoji} Merci ! +${o.reward} 🪙  +1 ⭐`); this.emit('change');
  }

  // ---------- Robots-jardiniers (agents IA autonomes) ----------
  robotCost() { return 120 + 80 * this.s.robots.length; }
  buyRobot() {
    if (this.s.robots.length >= 3) return this.toast('Maximum 3 robots');
    const cost = this.robotCost();
    if (this.s.coins < cost) { sfx('error'); return this.toast('Pas assez de pièces'); }
    this.s.coins -= cost;
    const end = this.s.path[this.s.path.length - 1];
    this.s.robots.push({ x: end.c + 0.5, y: end.r - 0.5, target: null, work: 0 });
    sfx('build'); this.toast('🤖 Robot-jardinier activé !'); this.emit('change');
  }

  // ---------- Cycle jour / nuit ----------
  startDay(first = false) {
    const s = this.s;
    s.phase = 'day'; s.dayTime = 0; s.dayLen = s.day === 1 ? 80 : 50;
    if (!first) {
      const before = s.orders.length;
      s.orders = s.orders.filter(o => o.deadline >= s.day);
      if (s.orders.length < before) { s.rep = Math.max(0, s.rep - 1); this.toast('Une commande a expiré… -1 ⭐'); }
      const upkeep = s.robots.length * 4;
      if (upkeep) { s.coins = Math.max(0, s.coins - upkeep); }
    }
    s.market.event = s.day > 1 && Math.random() < 0.6 ? pick(MARKET_EVENTS) : null;
    if (s.market.event) this.toast('🏪 ' + s.market.event.text);
    this.genOrders();
    sfx('day');
    this.save();
    this.emit('change');
  }

  startNight() {
    const s = this.s;
    if (s.phase !== 'day') return;
    if (s.tutorial < 4) { s.tutorial = 4; this.emit('tutorial', 4); }
    const left = Math.max(0, s.dayLen - s.dayTime);
    const bonus = Math.floor(left / 3);
    if (bonus > 0) { s.coins += bonus; this.toast(`Nuit anticipée : +${bonus} 🪙`); }
    s.phase = 'night';
    const n = s.day;
    const count = Math.round(5 + n * 2.4);
    const w = this.swarm.spawnWeights(n);
    const keys = Object.keys(w), tot = keys.reduce((a, k) => a + w[k], 0);
    this.spawnQueue = [];
    for (let i = 0; i < count; i++) {
      let r = Math.random() * tot, sp = keys[0];
      for (const k of keys) { r -= w[k]; if (r <= 0) { sp = k; break; } }
      this.spawnQueue.push(sp);
    }
    if (n % 5 === 0) this.spawnQueue.push('boar');
    this.spawnInterval = Math.max(0.5, 1.4 - n * 0.05);
    this.spawnTimer = 1.5;
    sfx('night');
    this.emit('change');
  }

  endNight() {
    const s = this.s;
    s.phase = 'report';
    const reward = 10 + s.day * 3;
    s.coins += reward;
    const report = this.swarm.evolve(s.day + 1);
    this.emit('nightEnd', { report, reward, day: s.day });
  }

  nextDay() { this.s.day++; this.startDay(); }

  // ---------- Actions joueur ----------
  tapCell(r, c) {
    const cell = this.cell(r, c); if (!cell) return;
    const t = this.tool;
    if (cell.tower && t?.kind !== 'shovel') { this.selected = { r, c }; sfx('click'); return this.emit('towerTap', r, c); }
    if (t?.kind === 'crop') return this.plant(r, c, t.id);
    if (t?.kind === 'tower') return this.build(r, c, t.id);
    if (t?.kind === 'shovel') {
      if (cell.crop) { cell.crop = null; cell.last = null; sfx('plant'); this.emit('change'); }
      return;
    }
    if (cell.crop && cell.crop.g >= 1) return this.harvest(r, c);
    this.selected = null;
  }

  plant(r, c, id) {
    const cell = this.cell(r, c), def = CROPS[id];
    if (cell.t !== 'g' || cell.crop || cell.tower) return;
    if (this.s.coins < def.cost) { sfx('error'); return this.toast('Pas assez de pièces'); }
    this.s.coins -= def.cost;
    cell.crop = { id, g: 0 }; cell.last = id;
    this.puff(c + 0.5, r + 0.5, '#7a4a2a', 6);
    sfx('plant');
    if (this.s.tutorial === 2 && id === 'sunflower') this.advanceTutorial();
    this.emit('change');
  }

  harvest(r, c, silent) {
    const cell = this.cell(r, c), crop = cell.crop;
    if (!crop || crop.g < 1) return false;
    const def = CROPS[crop.id], room = this.cap() - this.s.stock[def.item];
    if (room <= 0) { if (!silent) this.floater(c + 0.5, r + 0.3, 'Silo plein !', '#ff6b6b'); return false; }
    const n = Math.min(room, def.yield);
    this.s.stock[def.item] += n; this.s.stats.harvest += n;
    cell.crop = null; cell.last = crop.id;
    this.floater(c + 0.5, r + 0.3, `+${n}${ITEMS[def.item].emoji}`, '#fff');
    this.puff(c + 0.5, r + 0.5, '#ffe27a', 8);
    sfx('harvest');
    if (this.s.tutorial === 0) this.advanceTutorial();
    this.emit('change');
    return true;
  }

  build(r, c, id) {
    const cell = this.cell(r, c), def = TOWERS[id];
    if (cell.t !== 'g' || cell.crop || cell.tower) return;
    if (this.s.coins < def.cost) { sfx('error'); return this.toast('Pas assez de pièces'); }
    this.s.coins -= def.cost;
    cell.tower = { id, lvl: 0, cd: 0, shots: 0, ang: -Math.PI / 2, spent: def.cost };
    this.puff(c + 0.5, r + 0.5, '#d7c49e', 10);
    sfx('build');
    if (this.s.tutorial === 1) this.advanceTutorial();
    this.emit('change');
  }

  upgradeCost(t) { return t.lvl >= 2 ? null : Math.round(TOWERS[t.id].cost * UPGRADE_MULT[t.lvl + 1]); }
  upgrade(r, c) {
    const t = this.cell(r, c)?.tower; if (!t) return;
    const cost = this.upgradeCost(t);
    if (cost == null) return;
    if (this.s.coins < cost) { sfx('error'); return this.toast('Pas assez de pièces'); }
    this.s.coins -= cost; t.lvl++; t.spent += cost;
    this.puff(c + 0.5, r + 0.5, '#fff6a8', 14); sfx('build'); this.emit('change');
  }
  sellTower(r, c) {
    const cell = this.cell(r, c), t = cell?.tower; if (!t) return;
    const refund = Math.floor(t.spent * 0.6);
    this.s.coins += refund; cell.tower = null; this.selected = null;
    this.puff(c + 0.5, r + 0.5, '#d7c49e', 10); sfx('coin'); this.emit('change');
  }

  advanceTutorial() { this.s.tutorial++; this.emit('tutorial', this.s.tutorial); }

  // ---------- Simulation ----------
  update(dt) {
    if (this.paused || !this.s) return;
    dt = Math.min(dt, 0.05) * this.speed;
    this.time += dt;
    const s = this.s;
    this.nightAlpha += ((s.phase === 'night' ? 1 : 0) - this.nightAlpha) * Math.min(1, dt * 1.5);

    // Marché : les prix reviennent doucement vers leur cible.
    for (const k of ITEM_KEYS) s.market.mult[k] += (this.targetMult(k) - s.market.mult[k]) * 0.03 * dt;

    if (s.phase === 'day') {
      s.dayTime += dt;
      if (s.dayTime >= s.dayLen) this.startNight();
    }
    if (s.phase === 'over') return this.updateFx(dt);

    // Croissance des cultures
    this.forCells((cell, r, c) => {
      if (cell.crop && cell.crop.g < 1) {
        const def = CROPS[cell.crop.id];
        cell.crop.g = Math.min(1, cell.crop.g + dt / def.grow * (this.nearWater(r, c) ? 1.5 : 1));
      }
    });

    this.updateSpawns(dt);
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateRobots(dt);
    this.updateFx(dt);

    if (s.phase === 'night' && this.spawnQueue.length === 0 && this.enemies.length === 0) this.endNight();
    this.hudTimer = (this.hudTimer || 0) + dt;
    if (this.hudTimer > 0.25) { this.hudTimer = 0; this.emit('tick'); }
  }

  updateSpawns(dt) {
    if (this.s.phase !== 'night' || !this.spawnQueue.length) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.spawnInterval * rand(0.7, 1.3);
    const sp = this.spawnQueue.shift();
    const base = ENEMIES[sp], night = this.s.day;
    let stats, idx = -1;
    if (base.boss) {
      stats = { maxHp: base.hp * (1 + 0.25 * (night / 5 - 1)), speed: base.speed, armor: 2, res: this.swarm.resistanceProfile(), hunger: 0 };
    } else {
      idx = this.swarm.pick(sp, night);
      stats = this.swarm.express(sp, idx, night);
    }
    this.enemies.push({
      sp, idx, d: -0.8, x: 0, y: 0, hp: stats.maxHp, maxHp: stats.maxHp, speed: stats.speed,
      armor: stats.armor, res: stats.res, hunger: stats.hunger, flying: !!base.flying, boss: !!base.boss,
      reward: base.reward, barnDmg: base.barnDmg || 1, eating: 0, eatCell: null, lastTile: -1,
      eaten: 0, flip: 1, wob: Math.random() * 6, flash: 0, burn: null, poison: null, slow: 0,
    });
  }

  posAt(d) {
    const p = this.s.path;
    if (d < 0) return { x: p[0].c + 0.5, y: p[0].r + 0.5 + d };
    const i = Math.min(p.length - 2, Math.floor(d)), f = Math.min(1, d - i);
    const a = p[i], b = p[i + 1];
    return { x: a.c + 0.5 + (b.c - a.c) * f, y: a.r + 0.5 + (b.r - a.r) * f };
  }

  updateEnemies(dt) {
    const s = this.s, last = s.path.length - 1;
    const scarecrows = [];
    this.forCells((cell, r, c) => { if (cell.tower?.id === 'scarecrow') scarecrows.push({ x: c + 0.5, y: r + 0.5, t: cell.tower }); });

    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      // Effets sur la durée
      if (e.burn) { this.hurt(e, e.burn.dps * dt, 'fire', true); if ((e.burn.t -= dt) <= 0) e.burn = null; if (Math.random() < 0.3) this.particles.push({ x: e.x + rand(-0.15, 0.15), y: e.y, vx: 0, vy: -0.8, life: 0.4, max: 0.4, color: '#ff8a3d', size: 0.06 }); }
      if (e.poison) { this.hurt(e, e.poison.dps * dt, 'poison', true); if ((e.poison.t -= dt) <= 0) e.poison = null; }
      if (e.dead) continue;

      // Ralentissement des épouvantails (les volants l'ignorent)
      e.slow = 0;
      if (!e.flying) for (const sc of scarecrows) {
        const def = TOWERS.scarecrow;
        if (Math.hypot(sc.x - e.x, sc.y - e.y) <= def.range[sc.t.lvl]) e.slow = Math.max(e.slow, def.slow[sc.t.lvl]);
      }

      if (e.eating > 0) {
        e.eating -= dt;
        if (e.eating <= 0) {
          const cell = e.eatCell && this.cell(e.eatCell.r, e.eatCell.c);
          if (cell?.crop) {
            const em = CROPS[cell.crop.id].emoji;
            cell.crop = null; e.eaten++; s.stats.eaten++;
            this.floater(e.eatCell.c + 0.5, e.eatCell.r + 0.4, `😋 -${em}`, '#ffb3b3');
          }
          e.eatCell = null;
        }
      } else {
        e.d += e.speed * (1 - e.slow) * dt;
      }
      const p = this.posAt(e.d);
      if (p.x !== e.x) e.flip = p.x < e.x ? -1 : 1;
      e.x = p.x; e.y = p.y;

      // Grignotage des cultures au bord du chemin
      const tile = Math.round(e.d);
      if (tile !== e.lastTile && tile >= 0 && tile < last && e.eating <= 0) {
        e.lastTile = tile;
        const pt = s.path[tile];
        const near = neighbors(s.grid, pt.r, pt.c, e.flying).filter(n => n.cell.crop);
        if (near.length) {
          const n = pick(near);
          const chance = e.hunger * 0.55 * (this.isGuarded(n.r, n.c) ? 0.3 : 1);
          if (Math.random() < chance) { e.eating = 1.1; e.eatCell = { r: n.r, c: n.c }; }
        }
      }

      if (e.d >= last) {
        e.dead = true; e.reached = true;
        s.hearts -= e.barnDmg;
        this.floater(e.x, e.y - 0.3, `-${e.barnDmg}❤️`, '#ff6b6b');
        this.shake = 0.3;
        sfx('hurt');
        this.emit('change');
        if (s.hearts <= 0) { s.hearts = 0; return this.gameOver(); }
      }
    }
    // Fin de vie : on transmet la "fitness" à l'Essaim.
    this.enemies = this.enemies.filter(e => {
      if (!e.dead) return true;
      if (e.idx >= 0) {
        const prog = clamp(e.d / last, 0, 1);
        this.swarm.recordFitness(e.sp, e.idx, prog + 0.4 * e.eaten + (e.reached ? 1.5 : 0));
      }
      return false;
    });
  }

  hurt(e, amount, type, dot = false) {
    if (e.dead) return;
    let a = amount * (1 - (e.res[type] || 0));
    if (type === 'phys') a = Math.max(a * 0.25, a - e.armor);
    if (type === 'expl') a = Math.max(a * 0.4, a - e.armor * 0.5);
    this.swarm.recordDamage(type, a);
    e.hp -= a;
    if (!dot) e.flash = 0.08;
    if (e.hp <= 0) {
      e.dead = true;
      this.s.coins += e.reward; this.s.stats.kills++;
      this.floater(e.x, e.y - 0.3, `+${e.reward}🪙`, '#ffe066');
      this.puff(e.x, e.y, e.boss ? '#a0522d' : '#9be37a', e.boss ? 24 : 8);
      sfx('kill');
      this.emit('change');
    }
  }

  targetsInRange(x, y, range, air) {
    return this.enemies.filter(e => !e.dead && e.d > -0.3 && (air || !e.flying) && Math.hypot(e.x - x, e.y - y) <= range);
  }

  updateTowers(dt) {
    const s = this.s;
    this.forCells((cell, r, c) => {
      const t = cell.tower; if (!t) return;
      const def = TOWERS[t.id]; if (!def.rate) return;
      t.cd -= dt;
      if (t.cd > 0) return;
      const x = c + 0.5, y = r + 0.5, range = def.range[t.lvl];
      const tg = this.targetsInRange(x, y, range, def.hitsAir);
      if (!tg.length) return;
      if (def.ammo) {
        if (t.shots <= 0) {
          if (s.stock[def.ammo] > 0) { s.stock[def.ammo]--; t.shots += def.perAmmo; t.noAmmo = false; this.emit('change'); }
          else { t.noAmmo = true; t.cd = 0.5; return; }
        }
        t.shots--;
      }
      t.cd = def.rate[t.lvl];
      tg.sort((a, b) => b.d - a.d);
      const target = tg[0];
      t.ang = Math.atan2(target.y - y, target.x - x);
      let dmg = def.dmg[t.lvl];

      if (t.id === 'seeder') {
        this.projectiles.push({ k: 'seed', x, y, target, spd: 9, dmg, type: 'phys' });
        sfx('shoot');
      } else if (t.id === 'flamer') {
        for (const e of tg) { this.hurt(e, dmg, 'fire'); e.burn = { t: 2, dps: dmg * 0.4 }; }
        for (let i = 0; i < 14; i++) {
          const a = rand(0, Math.PI * 2), v = rand(0.6, 1.8) * range;
          this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.45, max: 0.45, color: pick(['#ff6a00', '#ffb347', '#ff3d2e']), size: rand(0.06, 0.12) });
        }
        sfx('flame');
      } else if (t.id === 'catapult') {
        const lead = this.posAt(target.d + target.speed * (1 - target.slow) * 0.8);
        this.projectiles.push({ k: 'pumpkin', sx: x, sy: y, tx: lead.x, ty: lead.y, t: 0, dur: 0.8, dmg, splash: def.splash, x, y });
      } else if (t.id === 'hive') {
        let boost = 0;
        for (const n of neighbors(s.grid, r, c, true)) if (n.cell.crop?.id === 'sunflower' && n.cell.crop.g >= 1) boost++;
        dmg *= 1 + 0.35 * boost;
        this.projectiles.push({ k: 'bee', x: x + rand(-0.2, 0.2), y: y - 0.2, target, spd: 5, dmg, type: 'poison', ph: Math.random() * 6 });
      }
    });
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.k === 'pumpkin') {
        p.t += dt / p.dur;
        p.x = p.sx + (p.tx - p.sx) * p.t; p.y = p.sy + (p.ty - p.sy) * p.t;
        if (p.t >= 1) {
          p.done = true;
          for (const e of this.targetsInRange(p.tx, p.ty, p.splash, false)) this.hurt(e, p.dmg, 'expl');
          for (let i = 0; i < 20; i++) {
            const a = rand(0, Math.PI * 2), v = rand(0.5, 2.5);
            this.particles.push({ x: p.tx, y: p.ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, max: 0.6, color: pick(['#ff9f1c', '#ffbf69', '#6b4226']), size: rand(0.05, 0.12) });
          }
          this.shake = Math.max(this.shake || 0, 0.12);
          sfx('boom');
        }
        continue;
      }
      const e = p.target;
      if (e.dead) { p.done = true; continue; }
      const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
      if (dist < 0.18) {
        p.done = true;
        this.hurt(e, p.dmg, p.type);
        if (p.k === 'bee') e.poison = { t: 3, dps: p.dmg * 0.6 };
        continue;
      }
      let vx = dx / dist * p.spd, vy = dy / dist * p.spd;
      if (p.k === 'bee') { p.ph += dt * 14; vx += Math.cos(p.ph) * 2; vy += Math.sin(p.ph) * 2; }
      p.x += vx * dt; p.y += vy * dt;
    }
    this.projectiles = this.projectiles.filter(p => !p.done);
  }

  updateRobots(dt) {
    const s = this.s;
    const reserved = new Set(s.robots.filter(r => r.target).map(r => r.target.r + ',' + r.target.c));
    for (const rb of s.robots) {
      if (!rb.target) {
        // IA utilitaire : chaque action candidate reçoit un score valeur/distance.
        let best = null, bestScore = 0;
        this.forCells((cell, r, c) => {
          if (reserved.has(r + ',' + c) || cell.t !== 'g') return;
          const dist = Math.hypot(c + 0.5 - rb.x, r + 0.5 - rb.y);
          let score = 0, act = null;
          if (cell.crop && cell.crop.g >= 1 && s.stock[CROPS[cell.crop.id].item] < this.cap()) {
            score = 3 / (dist + 1); act = 'harvest';
          } else if (!cell.crop && !cell.tower && cell.last && s.autoReplant && s.coins >= CROPS[cell.last].cost + 15) {
            score = 1.6 / (dist + 1); act = 'plant';
          }
          if (score > bestScore) { bestScore = score; best = { r, c, act }; }
        });
        if (best) { rb.target = best; reserved.add(best.r + ',' + best.c); }
        else { rb.y += Math.sin(this.time * 2 + rb.x) * 0.002; continue; }
      }
      const tx = rb.target.c + 0.5, ty = rb.target.r + 0.5;
      const dx = tx - rb.x, dy = ty - rb.y, dist = Math.hypot(dx, dy);
      if (dist > 0.05) {
        const step = Math.min(dist, 2.4 * dt);
        rb.x += dx / dist * step; rb.y += dy / dist * step;
        rb.flip = dx < 0 ? -1 : 1;
      } else {
        rb.work += dt;
        if (rb.work > 0.5) {
          rb.work = 0;
          const { r, c, act } = rb.target;
          const cell = this.cell(r, c);
          if (act === 'harvest' && cell.crop?.g >= 1) this.harvest(r, c, true);
          else if (act === 'plant' && !cell.crop && !cell.tower && cell.last && s.coins >= CROPS[cell.last].cost) {
            s.coins -= CROPS[cell.last].cost; cell.crop = { id: cell.last, g: 0 }; this.puff(c + 0.5, r + 0.5, '#7a4a2a', 5); this.emit('change');
          }
          rb.target = null;
        }
      }
    }
  }

  updateFx(dt) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floaters) { f.y -= dt * 0.7; f.life -= dt; }
    this.floaters = this.floaters.filter(f => f.life > 0);
    if (this.shake) this.shake = Math.max(0, this.shake - dt);
  }

  puff(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(0.4, 1.6);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, life: 0.5, max: 0.5, color, size: rand(0.04, 0.09) });
    }
  }
  floater(x, y, text, color) { this.floaters.push({ x, y, text, color, life: 1.2 }); }

  gameOver() {
    const s = this.s;
    s.phase = 'over';
    const nights = s.day - 1;
    let best = this.best();
    if (nights > best) { best = nights; try { localStorage.setItem(BEST_KEY, best); } catch { } }
    this.clearSave();
    this.emit('gameOver', { nights, best, stats: s.stats });
  }

  // ---------- Entrées tactiles ----------
  bindInput() {
    const cv = this.cv;
    let down = false, moved = false, startTile = null, visited = new Set();
    const tileAt = (ev) => {
      const rect = cv.getBoundingClientRect();
      const x = (ev.clientX - rect.left - this.ox) / this.T, y = (ev.clientY - rect.top - this.oy) / this.T;
      const c = Math.floor(x), r = Math.floor(y);
      return r >= 0 && r < ROWS && c >= 0 && c < COLS ? { r, c } : null;
    };
    cv.addEventListener('pointerdown', (ev) => {
      if (!this.s || this.s.phase === 'over' || this.paused) return;
      down = true; moved = false; visited.clear();
      startTile = tileAt(ev);
      if (startTile) { visited.add(startTile.r + ',' + startTile.c); this.tapCell(startTile.r, startTile.c); }
      try { cv.setPointerCapture(ev.pointerId); } catch { }
    });
    cv.addEventListener('pointermove', (ev) => {
      if (!down) return;
      const t = tileAt(ev); if (!t) return;
      const k = t.r + ',' + t.c;
      if (visited.has(k)) return;
      visited.add(k); moved = true;
      // Glisser = récolte en chaîne, ou plantation/pose en chaîne avec un outil.
      const cell = this.cell(t.r, t.c);
      if (!this.tool) { if (cell.crop?.g >= 1) this.harvest(t.r, t.c); }
      else if (this.tool.kind !== 'tower') this.tapCell(t.r, t.c);
    });
    const up = () => { down = false; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }

  // ---------- Rendu ----------
  resize() {
    const dpr = this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = this.cv.parentElement.getBoundingClientRect();
    this.W = rect.width; this.H = rect.height;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    this.T = Math.floor(Math.min(this.W / COLS, this.H / ROWS));
    this.ox = Math.floor((this.W - this.T * COLS) / 2);
    this.oy = Math.floor((this.H - this.T * ROWS) / 2);
    if (this.s) this.buildTerrain();
  }

  // Le terrain statique est pré-rendu dans un canvas hors-écran.
  buildTerrain() {
    if (!this.T) return;
    const T = this.T, dpr = this.dpr, s = this.s;
    const off = this.terrain || (this.terrain = document.createElement('canvas'));
    off.width = Math.round(this.W * dpr); off.height = Math.round(this.H * dpr);
    const g = off.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Fond : lisière de forêt
    const bg = g.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, '#3f7d4a'); bg.addColorStop(1, '#5d9c52');
    g.fillStyle = bg; g.fillRect(0, 0, this.W, this.H);
    g.translate(this.ox, this.oy);
    let seed = 7;
    const srand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      g.fillStyle = (r + c) % 2 ? '#8fd16a' : '#86c862';
      g.fillRect(c * T, r * T, T, T);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = 'rgba(60,120,40,0.35)';
        const x = c * T + srand() * T, y = r * T + srand() * T;
        g.fillRect(x, y, 1.5, T * 0.08);
      }
      if (srand() < 0.12) { g.fillStyle = pick(['#fff', '#ffd6e8', '#fff3a3']); g.beginPath(); g.arc(c * T + srand() * T, r * T + srand() * T, T * 0.035, 0, 7); g.fill(); }
    }
    // Chemin
    const pts = s.path.map(p => [(p.c + 0.5) * T, (p.r + 0.5) * T]);
    pts.unshift([pts[0][0], -T]);
    const stroke = (w, col) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    };
    stroke(T * 0.86, '#b58a57'); stroke(T * 0.74, '#dcbc85'); stroke(T * 0.3, 'rgba(255,240,200,0.25)');
    for (let i = 1; i < pts.length; i++) for (let k = 0; k < 2; k++) {
      g.fillStyle = 'rgba(140,100,60,0.5)';
      g.beginPath(); g.arc(pts[i][0] + (srand() - 0.5) * T * 0.5, pts[i][1] + (srand() - 0.5) * T * 0.5, T * 0.03, 0, 7); g.fill();
    }
    // Eau et rochers
    this.forCells((cell, r, c) => {
      const x = c * T, y = r * T;
      if (cell.t === 'w') {
        g.fillStyle = '#4aa3d8'; roundRect(g, x + T * 0.06, y + T * 0.06, T * 0.88, T * 0.88, T * 0.35); g.fill();
        g.fillStyle = '#7cc8f0'; roundRect(g, x + T * 0.14, y + T * 0.12, T * 0.72, T * 0.6, T * 0.3); g.fill();
        g.fillStyle = '#3aa35a'; g.beginPath(); g.ellipse(x + T * 0.7, y + T * 0.65, T * 0.12, T * 0.07, 0.3, 0, 7); g.fill();
      } else if (cell.t === 'r') {
        g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.ellipse(x + T / 2, y + T * 0.72, T * 0.36, T * 0.12, 0, 0, 7); g.fill();
        g.fillStyle = '#9aa0a6'; g.beginPath(); g.ellipse(x + T * 0.45, y + T * 0.52, T * 0.32, T * 0.24, -0.2, 0, 7); g.fill();
        g.fillStyle = '#b9bfc5'; g.beginPath(); g.ellipse(x + T * 0.4, y + T * 0.45, T * 0.18, T * 0.12, -0.2, 0, 7); g.fill();
        g.fillStyle = '#868b90'; g.beginPath(); g.ellipse(x + T * 0.72, y + T * 0.62, T * 0.14, T * 0.12, 0, 0, 7); g.fill();
      }
    });
    // Arbres de la forêt autour de l'entrée
    const p0 = s.path[0];
    for (const dc of [-1, 1]) {
      const c = p0.c + dc;
      if (c >= 0 && c < COLS && s.grid[0][c].t === 'g') {
        const sp = emojiSprite('🌲', T * 0.75, dpr);
        g.drawImage(sp, (c + 0.5) * T - sp.logical / 2, 0.35 * T - sp.logical / 2, sp.logical, sp.logical);
      }
    }
    // Grange
    const b = s.path[s.path.length - 1];
    drawBarn(g, (b.c + 0.5) * T, (b.r + 0.55) * T, T);
  }

  render() {
    const ctx = this.ctx, T = this.T, dpr = this.dpr, s = this.s;
    if (!s || !this.terrain) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.terrain, 0, 0);
    let sx = 0, sy = 0;
    if (this.shake) { sx = rand(-1, 1) * this.shake * 12; sy = rand(-1, 1) * this.shake * 12; }
    ctx.setTransform(dpr, 0, 0, dpr, (this.ox + sx) * dpr, (this.oy + sy) * dpr);
    const tm = this.time;
    const spr = (e, px, x, y, flip = 1, alpha = 1) => {
      const sp = emojiSprite(e, px, dpr), L = sp.logical;
      ctx.globalAlpha = alpha;
      if (flip < 0) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(sp, -L / 2, -L / 2, L, L); ctx.restore(); }
      else ctx.drawImage(sp, x - L / 2, y - L / 2, L, L);
      ctx.globalAlpha = 1;
    };

    // Reflets animés de l'eau
    this.forCells((cell, r, c) => {
      if (cell.t !== 'w') return;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
      const o = Math.sin(tm * 2 + r + c) * T * 0.08;
      ctx.beginPath(); ctx.moveTo(c * T + T * 0.25 + o, r * T + T * 0.35); ctx.lineTo(c * T + T * 0.45 + o, r * T + T * 0.35); ctx.stroke();
    });

    // Cases disponibles quand un outil est sélectionné
    if (this.tool && this.tool.kind !== 'shovel') {
      const a = 0.18 + 0.1 * Math.sin(tm * 5);
      this.forCells((cell, r, c) => {
        if (cell.t === 'g' && !cell.crop && !cell.tower) {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          roundRect(ctx, c * T + 3, r * T + 3, T - 6, T - 6, T * 0.2); ctx.fill();
        }
      });
    }

    // Cultures
    this.forCells((cell, r, c) => {
      if (!cell.crop) return;
      const x = c * T, y = r * T, cr = cell.crop, def = CROPS[cr.id];
      ctx.fillStyle = '#8a5a3b'; roundRect(ctx, x + T * 0.1, y + T * 0.14, T * 0.8, T * 0.76, T * 0.18); ctx.fill();
      ctx.strokeStyle = '#6e4329'; ctx.lineWidth = Math.max(1, T * 0.03);
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + T * 0.2, y + T * (0.14 + 0.19 * i)); ctx.lineTo(x + T * 0.8, y + T * (0.14 + 0.19 * i)); ctx.stroke(); }
      const cx = x + T / 2, cy = y + T / 2;
      if (cr.g < 0.3) {
        const k = 0.4 + cr.g * 2;
        ctx.fillStyle = '#4caf50';
        ctx.beginPath(); ctx.ellipse(cx - T * 0.08 * k, cy, T * 0.1 * k, T * 0.05 * k, -0.6, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + T * 0.08 * k, cy - T * 0.02, T * 0.1 * k, T * 0.05 * k, 0.6, 0, 7); ctx.fill();
      } else if (cr.g < 1) {
        spr(def.emoji, T * (0.35 + cr.g * 0.35), cx, cy);
      } else {
        const bob = Math.sin(tm * 4 + r * 1.3 + c) * T * 0.04;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, T * 0.55);
        glow.addColorStop(0, 'rgba(255,245,170,0.75)'); glow.addColorStop(1, 'rgba(255,245,170,0)');
        ctx.fillStyle = glow; ctx.fillRect(x, y, T, T);
        spr(def.emoji, T * 0.78, cx, cy + bob);
      }
      if (cr.g < 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, T * 0.06);
        ctx.beginPath(); ctx.arc(x + T * 0.8, y + T * 0.8, T * 0.1, -Math.PI / 2, -Math.PI / 2 + cr.g * Math.PI * 2); ctx.stroke();
      }
    });

    // Ennemis au sol
    const drawEnemy = (e) => {
      const base = ENEMIES[e.sp], size = T * (e.boss ? 1.0 : 0.62);
      const bob = Math.sin(tm * 10 + e.wob) * T * 0.04;
      const x = e.x * T, y = e.y * T - (e.flying ? T * 0.3 : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(e.x * T, e.y * T + size * 0.32, size * 0.32, size * 0.11, 0, 0, 7); ctx.fill();
      if (e.slow > 0) { ctx.strokeStyle = 'rgba(120,200,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x * T, e.y * T + size * 0.3, size * 0.4, size * 0.14, 0, 0, 7); ctx.stroke(); }
      spr(base.emoji, size, x, y + bob, -e.flip, 1);
      if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; spr(base.emoji, size, x, y + bob, -e.flip, 0.6); ctx.globalCompositeOperation = 'source-over'; }
      if (e.poison) { ctx.fillStyle = 'rgba(120,220,90,0.8)'; ctx.beginPath(); ctx.arc(x + size * 0.3, y - size * 0.35 + Math.sin(tm * 6) * 3, T * 0.05, 0, 7); ctx.fill(); }
      if (e.eating > 0) spr('💬', T * 0.3, x + size * 0.35, y - size * 0.45);
      if (e.hp < e.maxHp) {
        const w = size * 0.8, h = Math.max(3, T * 0.07);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - w / 2, y - size * 0.6, w, h);
        ctx.fillStyle = e.boss ? '#ff5a5a' : '#7ee36a'; ctx.fillRect(x - w / 2, y - size * 0.6, w * Math.max(0, e.hp / e.maxHp), h);
      }
    };
    for (const e of this.enemies) if (!e.flying) drawEnemy(e);

    // Gardiens
    this.forCells((cell, r, c) => {
      const t = cell.tower; if (!t) return;
      const def = TOWERS[t.id], cx = c * T + T / 2, cy = r * T + T / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.3, T * 0.36, T * 0.12, 0, 0, 7); ctx.fill();
      if (t.id === 'scarecrow') {
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = T * 0.07; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, cy + T * 0.3); ctx.lineTo(cx, cy - T * 0.15); ctx.stroke();
        const sway = Math.sin(tm * 2 + c) * 0.08;
        ctx.save(); ctx.translate(cx, cy - T * 0.02); ctx.rotate(sway);
        ctx.beginPath(); ctx.moveTo(-T * 0.3, 0); ctx.lineTo(T * 0.3, 0); ctx.stroke();
        ctx.fillStyle = '#d9534f'; roundRect(ctx, -T * 0.14, -T * 0.06, T * 0.28, T * 0.26, T * 0.05); ctx.fill();
        ctx.fillStyle = '#f3d9a4'; ctx.beginPath(); ctx.arc(0, -T * 0.16, T * 0.11, 0, 7); ctx.fill();
        ctx.restore();
        spr('👒', T * 0.36, cx, cy - T * 0.3);
      } else {
        ctx.fillStyle = shade(def.color, -0.25); ctx.beginPath(); ctx.arc(cx, cy + T * 0.04, T * 0.4, 0, 7); ctx.fill();
        ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(cx, cy, T * 0.38, 0, 7); ctx.fill();
        ctx.fillStyle = shade(def.color, 0.3); ctx.beginPath(); ctx.arc(cx - T * 0.08, cy - T * 0.1, T * 0.16, 0, 7); ctx.fill();
        if (t.id === 'hive') {
          ctx.strokeStyle = shade(def.color, -0.35); ctx.lineWidth = 2;
          for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx - T * 0.3, cy + i * T * 0.13); ctx.lineTo(cx + T * 0.3, cy + i * T * 0.13); ctx.stroke(); }
          spr('🐝', T * 0.4, cx + Math.sin(tm * 6 + c) * T * 0.1, cy - T * 0.12 + Math.cos(tm * 7) * T * 0.05);
        } else {
          // Canon orienté vers la cible
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(t.ang);
          ctx.fillStyle = shade(def.color, -0.45); roundRect(ctx, 0, -T * 0.07, T * 0.38, T * 0.14, T * 0.05); ctx.fill();
          ctx.restore();
          spr(def.icon, T * 0.44, cx, cy - T * 0.02);
        }
      }
      for (let i = 0; i < t.lvl; i++) spr('⭐', T * 0.2, cx - T * 0.12 + i * T * 0.24, cy + T * 0.36);
      if (t.noAmmo) spr('❗', T * 0.32, cx + T * 0.3, cy - T * 0.35 + Math.sin(tm * 8) * 3);
    });

    // Rayon du Gardien sélectionné
    if (this.selected) {
      const t = this.cell(this.selected.r, this.selected.c)?.tower;
      if (t) {
        const range = TOWERS[t.id].range[t.lvl];
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc((this.selected.c + 0.5) * T, (this.selected.r + 0.5) * T, range * T, 0, 7); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
      } else this.selected = null;
    }

    // Projectiles
    for (const p of this.projectiles) {
      if (p.k === 'seed') { ctx.fillStyle = '#6b4226'; ctx.beginPath(); ctx.ellipse(p.x * T, p.y * T, T * 0.06, T * 0.045, 0, 0, 7); ctx.fill(); }
      else if (p.k === 'bee') {
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(p.x * T, p.y * T, T * 0.05, 0, 7); ctx.fill();
        ctx.fillStyle = '#222'; ctx.fillRect(p.x * T - 1, p.y * T - T * 0.05, 2, T * 0.1);
      } else if (p.k === 'pumpkin') {
        const h = Math.sin(Math.PI * p.t) * T * 1.3;
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(p.x * T, p.y * T, T * 0.15, T * 0.06, 0, 0, 7); ctx.fill();
        spr('🎃', T * 0.38, p.x * T, p.y * T - h);
      }
    }

    // Ennemis volants
    for (const e of this.enemies) if (e.flying) drawEnemy(e);

    // Robots-jardiniers
    for (const rb of s.robots) {
      const x = rb.x * T, y = rb.y * T - T * 0.25 + Math.sin(tm * 3 + rb.x) * T * 0.05;
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(rb.x * T, rb.y * T + T * 0.2, T * 0.2, T * 0.07, 0, 0, 7); ctx.fill();
      spr('🤖', T * 0.5, x, y, 1);
      if (rb.work > 0) spr('✨', T * 0.28, x + T * 0.25, y - T * 0.25);
    }

    // Particules
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x * T, p.y * T, p.size * T, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Nuit
    if (this.nightAlpha > 0.01) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgba(22,28,78,${0.42 * this.nightAlpha})`;
      ctx.fillRect(0, 0, this.W, this.H);
      for (let i = 0; i < 14; i++) {
        const fx = (Math.sin(i * 12.9 + tm * 0.3) * 0.5 + 0.5) * this.W;
        const fy = (Math.cos(i * 7.3 + tm * 0.23) * 0.5 + 0.5) * this.H;
        const a = (Math.sin(tm * 3 + i) * 0.5 + 0.5) * this.nightAlpha;
        ctx.fillStyle = `rgba(255,250,150,${a})`; ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, 7); ctx.fill();
      }
      ctx.setTransform(dpr, 0, 0, dpr, (this.ox + sx) * dpr, (this.oy + sy) * dpr);
    }

    // Textes flottants
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(T * 0.3)}px system-ui, sans-serif, ${EMOJI_FONT}`;
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(f.text, f.x * T, f.y * T); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x * T, f.y * T);
    }
    ctx.globalAlpha = 1;
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function drawBarn(g, x, y, T) {
  const w = T * 1.05, h = T * 0.75;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + h * 0.5, w * 0.6, T * 0.12, 0, 0, 7); g.fill();
  g.fillStyle = '#c0392b'; g.fillRect(x - w / 2, y - h * 0.3, w, h * 0.8);
  g.fillStyle = '#8e2a1f'; g.beginPath(); g.moveTo(x - w * 0.6, y - h * 0.25); g.lineTo(x, y - h * 0.95); g.lineTo(x + w * 0.6, y - h * 0.25); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.fillRect(x - w * 0.2, y + h * 0.02, w * 0.4, h * 0.48);
  g.strokeStyle = '#c0392b'; g.lineWidth = T * 0.04;
  g.beginPath(); g.moveTo(x - w * 0.2, y + h * 0.02); g.lineTo(x + w * 0.2, y + h * 0.5); g.moveTo(x + w * 0.2, y + h * 0.02); g.lineTo(x - w * 0.2, y + h * 0.5); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y - h * 0.45, T * 0.08, 0, 7); g.fill();
}
