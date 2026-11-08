'use strict';
/* ==========================================================================
   Moteur de combat — commun à la défense (tower defense) et aux expéditions
   ========================================================================== */
const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function resolveAtk(type, lvl) {
  const a = BUILDINGS[type].atk; if (!a) return null;
  return { dmg: a.dmg(lvl), range: a.range, rate: a.rate, air: a.air, ground: a.ground, splash: a.splash || 0, magic: !!a.magic, chain: a.chain || 0, aura: !!a.aura, slow: a.slow ? a.slow(lvl) : 0, proj: a.proj, z: a.z };
}

class Battle {
  constructor(mode, layout, opts) {
    this.mode = mode; this.opts = opts || {}; this.t = 0;
    const hm = this.opts.hpMul || 1;
    this.buildings = layout.map((b, i) => {
      const d = BUILDINGS[b.type]; const lvl = Math.max(1, b.lvl); const hp = d.hp(lvl) * hm;
      return { i, type: b.type, lvl, x: b.x, y: b.y, size: d.size, cx: b.x + d.size / 2, cy: b.y + d.size / 2, hp, maxHp: hp, cat: d.cat,
        atk: b.noAtk ? null : resolveAtk(b.type, lvl), disabled: !!b.upg || b.lvl < 1, upg: !!b.upg, cd: Math.random(), tgt: null, aim: 0.8, dead: false, flash: 0, recoil: 0, fill: 0.5,
        loot: b.loot || null };
    });
    this.occ = new Int16Array(MAP_N * MAP_N).fill(-1);
    for (const e of this.buildings) for (let y = e.y; y < e.y + e.size; y++) for (let x = e.x; x < e.x + e.size; x++) this.occ[y * MAP_N + x] = e.i;
    this.units = []; this.projs = []; this.fields = {}; this.ver = 0; this.uid = 1;
    this.over = false; this.result = null; this.loot = { gold: 0, sap: 0 }; this.kills = 0;
    this.perf = {}; this.destroyedW = 0;
    this.totalW = this.buildings.filter(e => e.cat !== 'wall').length;
    this.cit = this.buildings.find(e => e.type === 'citadel');
  }

  /* ---------- champs de navigation (Dijkstra multi-source) ---------- */
  goalPred(g) {
    switch (g) {
      case 'citadel': return e => e.type === 'citadel';
      case 'defense': return e => !!e.atk && e.type !== 'citadel';
      case 'resource': return e => e.cat === 'resource';
      case 'wall': return e => e.cat === 'wall';
      default: return e => e.cat !== 'wall';
    }
  }
  resolveGoal(g) {
    if (g === 'ally') return null;
    const alive = this.buildings.filter(e => !e.dead);
    if (!alive.length) return null;
    if (alive.some(this.goalPred(g))) return g;
    return alive.some(e => e.cat !== 'wall') ? 'any' : 'wall';
  }
  extraCost(i, pred) {
    const bi = this.occ[i]; if (bi < 0) return 0;
    const e = this.buildings[bi]; if (e.dead || pred(e)) return 0;
    return e.cat === 'wall' ? 2 + e.hp / 70 : 4 + e.hp / 55;
  }
  field(g) {
    const f = this.fields[g];
    if (f && f.ver === this.ver) return f.dist;
    const N = MAP_N, dist = new Float64Array(N * N).fill(1e9), pred = this.goalPred(g), heap = new MinHeap();
    for (const e of this.buildings) if (!e.dead && pred(e)) for (let y = e.y; y < e.y + e.size; y++) for (let x = e.x; x < e.x + e.size; x++) { dist[y * N + x] = 0; heap.push(0, y * N + x); }
    const extra = new Float64Array(N * N); for (let i = 0; i < N * N; i++) extra[i] = this.extraCost(i, pred);
    while (heap.size) {
      const i = heap.pop(), d = heap.lastKey; if (d > dist[i]) continue;
      const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of NB8) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        if (dx && dy && (this.blocked(x + dx, y) || this.blocked(x, y + dy))) continue;
        const j = ny * N + nx, nd = d + (dx && dy ? 1.414 : 1) + extra[i];
        if (nd < dist[j]) { dist[j] = nd; heap.push(nd, j); }
      }
    }
    this.fields[g] = { ver: this.ver, dist };
    return dist;
  }
  blocked(x, y) { if (x < 0 || y < 0 || x >= MAP_N || y >= MAP_N) return true; const bi = this.occ[y * MAP_N + x]; return bi >= 0 && !this.buildings[bi].dead; }
  bAt(x, y) { if (x < 0 || y < 0 || x >= MAP_N || y >= MAP_N) return null; const bi = this.occ[y * MAP_N + x]; return bi >= 0 && !this.buildings[bi].dead ? this.buildings[bi] : null; }

  /* ---------- unités ---------- */
  spawn(type, lvl, team, x, y, elite) {
    const d = UNITS[type]; const m = Math.pow(1.18, lvl - 1) * (elite ? 3 : 1);
    const u = { id: this.uid++, type, d, lvl, team, x, y, hp: d.hp * m, maxHp: d.hp * m, dmg: (d.dmg || 0) * Math.pow(1.18, lvl - 1) * (elite ? 1.6 : 1), heal: (d.heal || 0) * Math.pow(1.18, lvl - 1),
      cd: rnd(0, 0.6), tgt: null, scan: 0, slowT: 0, slowF: 1, frozenT: 0, bob: rnd(0, 6), face: 1, atkAnim: 0, hitFlash: 0, moving: false, elite: !!elite, dead: false };
    this.units.push(u);
    if (!this.perf[type]) this.perf[type] = { dmg: 0, housing: 0, n: 0 };
    this.perf[type].housing += d.housing * (elite ? 3 : 1); this.perf[type].n++;
    return u;
  }
  goalOf(u) { return this.mode === 'defense' && u.d.goal !== 'wall' && u.d.goal !== 'ally' ? (u.d.goal === 'defense' ? 'defense' : 'citadel') : this.resolveGoal(u.d.goal); }
  moveTo(u, tx, ty, spd, dt) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d < 0.001) return true;
    const st = Math.min(d, spd * dt);
    u.x += dx / d * st; u.y += dy / d * st; u.moving = true;
    const sx = dx - dy; if (Math.abs(sx) > 0.01) u.face = sx > 0 ? 1 : -1;
    return st >= d;
  }
  updateUnit(u, dt) {
    u.hitFlash = Math.max(0, u.hitFlash - dt); u.atkAnim = Math.max(0, u.atkAnim - dt); u.moving = false;
    if (u.frozenT > 0) { u.frozenT -= dt; return; }
    let spd = u.d.speed; if (u.slowT > 0) { u.slowT -= dt; spd *= u.slowF; }
    u.cd -= dt;
    if (u.d.healer) return this.updateHealer(u, dt, spd);
    if (u.tgt && u.tgt.dead) u.tgt = null;
    let g = this.goalOf(u);
    if (this.mode === 'defense' && g === 'defense' && !this.buildings.some(e => !e.dead && e.atk && e.type !== 'citadel')) g = 'citadel';
    if (!g) return;
    const pred = this.goalPred(g);
    // recherche d'une cible à portée
    u.scan -= dt;
    if (u.scan <= 0) {
      u.scan = 0.3;
      if (!u.tgt || !pred(u.tgt)) {
        let best = null, bd = 1e9;
        const reach = u.d.range + 0.15;
        for (const e of this.buildings) { if (e.dead || !pred(e)) continue; const dd = distToRect(u.x, u.y, e.x, e.y, e.size); if (dd <= reach && dd < bd) { bd = dd; best = e; } }
        if (best) u.tgt = best;
      }
    }
    if (u.d.air) {
      if (!u.tgt) {
        let best = null, bd = 1e9;
        for (const e of this.buildings) { if (e.dead || !pred(e)) continue; const dd = Math.hypot(e.cx - u.x, e.cy - u.y); if (dd < bd) { bd = dd; best = e; } }
        u.tgt = best;
      }
      if (!u.tgt) return;
      if (distToRect(u.x, u.y, u.tgt.x, u.tgt.y, u.tgt.size) <= u.d.range) this.attack(u);
      else this.moveTo(u, u.tgt.cx, u.tgt.cy, spd, dt);
      return;
    }
    if (u.tgt) {
      const dd = distToRect(u.x, u.y, u.tgt.x, u.tgt.y, u.tgt.size);
      if (dd <= u.d.range + 0.05) { this.attack(u); return; }
      const [px, py] = closestOnRect(u.x, u.y, u.tgt.x, u.tgt.y, u.tgt.size);
      if (dd < 1.6) { this.moveTo(u, px, py, spd, dt); return; }
      u.tgt = null;
    }
    // suivre le champ
    const f = this.field(g), N = MAP_N;
    const cx = clamp(Math.floor(u.x), 0, N - 1), cy = clamp(Math.floor(u.y), 0, N - 1);
    let best = -1, bv = 1e12;
    for (const [dx, dy] of NB8) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      if (dx && dy && (this.blocked(cx + dx, cy) || this.blocked(cx, cy + dy))) continue;
      const j = ny * N + nx; const v = (dx && dy ? 1.414 : 1) + this.extraCost(j, pred) + f[j];
      if (v < bv) { bv = v; best = j; }
    }
    if (best < 0) return;
    const bx = best % N, by = (best / N) | 0;
    const blk = this.bAt(bx, by);
    if (blk) { u.tgt = blk; const [px, py] = closestOnRect(u.x, u.y, blk.x, blk.y, blk.size); if (distToRect(u.x, u.y, blk.x, blk.y, blk.size) <= u.d.range + 0.05) this.attack(u); else this.moveTo(u, px, py, spd, dt); }
    else this.moveTo(u, bx + 0.5, by + 0.5, spd, dt);
  }
  updateHealer(u, dt, spd) {
    let best = null, bd = 1e9;
    for (const o of this.units) { if (o === u || o.dead || o.team !== u.team || o.d.healer) continue; const dd = Math.hypot(o.x - u.x, o.y - u.y); if (dd < bd) { bd = dd; best = o; } }
    if (best && bd > 1.2) this.moveTo(u, best.x, best.y, spd, dt);
    if (u.cd <= 0) {
      u.cd = 1;
      let any = false;
      for (const o of this.units) if (!o.dead && o.team === u.team && o.hp < o.maxHp && Math.hypot(o.x - u.x, o.y - u.y) <= u.d.range) { o.hp = Math.min(o.maxHp, o.hp + u.heal); any = true; Particles.sparkle(o.x, o.y, 14, '#7dffd9'); }
      if (any) Particles.ring(u.x, u.y, u.d.range, 'rgba(125,255,217,0.6)', 0.6);
    }
  }
  attack(u) {
    if (u.cd > 0) return;
    u.cd = u.d.rate; u.atkAnim = 0.3;
    const e = u.tgt; if (!e) return;
    if (u.d.suicide) {
      const r = u.d.splash;
      for (const b of this.buildings) { if (b.dead) continue; if (distToRect(u.x, u.y, b.x, b.y, b.size) <= r) this.hitBuilding(b, u.dmg * (b.cat === 'wall' ? u.d.wallMult : 1), u); }
      Particles.burst(u.x, u.y, 8, '#ffb347', 22, 2.5); Particles.ring(u.x, u.y, r, '#ffd27a', 0.4); Particles.smoke(u.x, u.y, 10);
      u.hp = 0; this.killUnit(u, true); return;
    }
    if (u.d.ranged || u.d.air) {
      const kind = u.d.air ? 'fire' : 'uarrow';
      const z0 = u.d.air ? 42 : 8;
      this.projs.push({ kind, x: u.x, y: u.y, z: z0, px: u.x, py: u.y, pz: z0, sx: u.x, sy: u.y, sz: z0, tb: e, tx: e.cx, ty: e.cy, tz: 18, t: 0, T: Math.max(0.15, Math.hypot(e.cx - u.x, e.cy - u.y) / 9), dmg: u.dmg, owner: u, splash: u.d.splash || 0 });
    } else this.hitBuilding(e, u.dmg, u);
  }
  hitBuilding(e, dmg, u) {
    if (e.dead) return;
    const real = Math.min(e.hp, dmg);
    e.hp -= dmg; e.flash = 0.12;
    if (u && this.perf[u.type]) this.perf[u.type].dmg += real;
    if (this.mode === 'attack' && e.loot) { this.loot.gold += e.loot.gold * real / e.maxHp; this.loot.sap += e.loot.sap * real / e.maxHp; }
    if (e.hp <= 0) this.destroy(e);
  }
  destroy(e) {
    e.dead = true; e.hp = 0; this.ver++; SFX.play('crash');
    Particles.debris(e.cx, e.cy, 10 + e.size * 6); for (let i = 0; i < 4 * e.size; i++) Particles.smoke(e.cx + rnd(-0.5, 0.5), e.cy + rnd(-0.5, 0.5), 10);
    if (e.cat !== 'wall') this.destroyedW++;
    if (this.onDestroy) this.onDestroy(e);
    if (this.mode === 'defense' && e.type === 'citadel') this.end(false);
    if (this.mode === 'attack' && this.destroyedW >= this.totalW) this.end(true);
  }
  hitUnit(u, dmg, magic) {
    if (u.dead) return;
    if (!magic) dmg *= 1 - (u.d.armor || 0);
    u.hp -= dmg; u.hitFlash = 0.08;
    if (u.hp <= 0) this.killUnit(u, false);
  }
  killUnit(u, self) {
    if (u.dead) return;
    u.dead = true; SFX.play('die');
    if (!self) { Particles.burst(u.x, u.y, 10, u.d.color, 10, 1.5); Particles.smoke(u.x, u.y, 6); }
    if (this.mode === 'defense' && u.team === 'enemy') {
      this.kills++;
      const g = Math.round(u.d.housing * (3 + S.threat * 1.2) * (u.elite ? 4 : 1));
      this.loot.gold += g; this.loot.sap += Math.round(g * 0.8);
      Particles.text(u.x, u.y, 30, '+' + g, '#ffd86a');
    }
  }

  /* ---------- défenses ---------- */
  updateTowers(dt) {
    for (const e of this.buildings) {
      e.flash = Math.max(0, e.flash - dt); e.recoil = Math.max(0, e.recoil - dt * 3);
      if (e.dead || !e.atk || e.disabled) continue;
      const a = e.atk; e.cd -= dt;
      if (a.aura) {
        if (e.cd <= 0) {
          e.cd = a.rate;
          let any = false;
          for (const u of this.units) { if (u.dead || Math.hypot(u.x - e.cx, u.y - e.cy) > a.range) continue; u.slowT = 0.7; u.slowF = 1 - a.slow; this.hitUnit(u, a.dmg, true); any = true; if (Math.random() < 0.3) Particles.sparkle(u.x, u.y, 10, '#bfe9ff'); }
          if (any) Particles.ring(e.cx, e.cy, a.range, 'rgba(160,220,255,0.35)', 0.5);
        }
        continue;
      }
      if (e.tgt && (e.tgt.dead || Math.hypot(e.tgt.x - e.cx, e.tgt.y - e.cy) > a.range)) e.tgt = null;
      if (!e.tgt) {
        let best = null, bd = 1e9;
        for (const u of this.units) { if (u.dead) continue; if (u.d.air ? !a.air : !a.ground) continue; const dd = Math.hypot(u.x - e.cx, u.y - e.cy); if (dd <= a.range && dd < bd) { bd = dd; best = u; } }
        e.tgt = best;
      }
      if (!e.tgt) continue;
      const u = e.tgt;
      e.aim = Math.atan2(u.y - e.cy, u.x - e.cx);
      if (e.cd > 0) continue;
      e.cd = a.rate;
      const z0 = a.z || B_HEIGHT[e.type] - 14;
      const uz = u.d.air ? 46 : 8;
      if (a.proj === 'ball') {
        e.recoil = 1; SFX.play('boom');
        const d = Math.hypot(u.x - e.cx, u.y - e.cy);
        this.projs.push({ kind: 'ball', x: e.cx, y: e.cy, z: 26, px: e.cx, py: e.cy, pz: 26, sx: e.cx, sy: e.cy, sz: 26, tx: u.x, ty: u.y, tz: 0, t: 0, T: 0.35 + d / 9, arc: 30 + d * 6, dmg: a.dmg, splash: a.splash });
        Particles.smoke(e.cx + Math.cos(e.aim) * 0.9, e.cy + Math.sin(e.aim) * 0.9, 26);
      } else {
        SFX.play(a.proj === 'bolt' ? 'zap' : 'arrow');
        this.projs.push({ kind: a.proj, x: e.cx, y: e.cy, z: z0, px: e.cx, py: e.cy, pz: z0, sx: e.cx, sy: e.cy, sz: z0, tu: u, tx: u.x, ty: u.y, tz: uz, t: 0, T: Math.max(0.12, Math.hypot(u.x - e.cx, u.y - e.cy) / (a.proj === 'bolt' ? 11 : 15)), dmg: a.dmg, magic: a.magic, chain: a.chain });
      }
    }
  }
  updateProjs(dt) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.px = p.x; p.py = p.y; p.pz = p.z;
      if (p.tu && !p.tu.dead) { p.tx = p.tu.x; p.ty = p.tu.y; }
      p.t += dt / p.T; const k = Math.min(1, p.t);
      p.x = lerp(p.sx, p.tx, k); p.y = lerp(p.sy, p.ty, k);
      p.z = lerp(p.sz, p.tz, k) + (p.arc ? Math.sin(k * Math.PI) * p.arc : 0);
      if (p.kind === 'bolt' && Math.random() < 0.6) Particles.sparkle(p.x, p.y, p.z, '#a8fff2');
      if (p.t < 1) continue;
      this.projs.splice(i, 1);
      if (p.kind === 'ball') {
        for (const u of this.units) if (!u.dead && !u.d.air && Math.hypot(u.x - p.tx, u.y - p.ty) <= p.splash) this.hitUnit(u, p.dmg, false);
        Particles.burst(p.tx, p.ty, 4, '#c9bfa8', 10, 1.6); Particles.ring(p.tx, p.ty, p.splash, 'rgba(255,220,160,0.6)', 0.35); Particles.smoke(p.tx, p.ty, 4);
      } else if (p.kind === 'fire' || p.kind === 'uarrow') {
        if (p.tb && !p.tb.dead) {
          if (p.splash) { for (const b of this.buildings) if (!b.dead && distToRect(p.tx, p.ty, b.x, b.y, b.size) <= p.splash) this.hitBuilding(b, p.dmg, p.owner); }
          else this.hitBuilding(p.tb, p.dmg, p.owner);
        }
        if (p.kind === 'fire') Particles.burst(p.tx, p.ty, 16, '#ff9a4a', 8, 1.2);
      } else {
        if (p.tu && !p.tu.dead) {
          this.hitUnit(p.tu, p.dmg, p.magic);
          if (p.kind === 'bolt') {
            Particles.burst(p.tx, p.ty, p.tz, '#a8fff2', 6, 1.2);
            let from = p.tu; const hit = new Set([p.tu]);
            for (let c = 0; c < p.chain; c++) {
              let nb = null, nd = 2.6;
              for (const o of this.units) { if (o.dead || hit.has(o)) continue; const dd = Math.hypot(o.x - from.x, o.y - from.y); if (dd < nd) { nd = dd; nb = o; } }
              if (!nb) break;
              hit.add(nb); Particles.zap(from.x, from.y, from.d.air ? 46 : 8, nb.x, nb.y, nb.d.air ? 46 : 8);
              this.hitUnit(nb, p.dmg * 0.6, true); from = nb;
            }
          }
        }
      }
    }
  }
  separate() {
    const U = this.units;
    for (let i = 0; i < U.length; i++) {
      const a = U[i]; if (a.dead || a.d.air) continue;
      for (let j = i + 1; j < U.length; j++) {
        const b = U[j]; if (b.dead || b.d.air) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, r = 0.32;
        if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2), push = (r - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
      }
      // sortir des bâtiments
      const e = this.bAt(Math.floor(a.x), Math.floor(a.y));
      if (e) {
        const l = a.x - e.x, r2 = e.x + e.size - a.x, t = a.y - e.y, bt = e.y + e.size - a.y, m = Math.min(l, r2, t, bt);
        if (m === l) a.x = e.x - 0.02; else if (m === r2) a.x = e.x + e.size + 0.02; else if (m === t) a.y = e.y - 0.02; else a.y = e.y + e.size + 0.02;
      }
      a.x = clamp(a.x, 0.05, MAP_N - 0.05); a.y = clamp(a.y, 0.05, MAP_N - 0.05);
    }
  }
  update(dt) {
    if (this.over) return;
    this.t += dt;
    for (const u of this.units) if (!u.dead) this.updateUnit(u, dt);
    this.updateTowers(dt);
    this.updateProjs(dt);
    this.separate();
    this.units = this.units.filter(u => !u.dead);
    if (this.onUpdate) this.onUpdate(dt);
  }
  end(win) { if (this.over) return; this.over = true; this.result = { win }; if (this.onEnd) this.onEnd(win); }
  destructionPct() { return this.totalW ? this.destroyedW / this.totalW : 0; }
}
