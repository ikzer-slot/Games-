// Les deux IA du jeu.
// 1) Le Frelon chef : bandit manchot UCB1 qui apprend par quel côté attaquer.
// 2) La Reine : planificateur qui simule l'économie de la colonie pour choisir
//    la meilleure répartition butineuses / gardiennes / nourrices.
import { SECTORS, FLOWERS, DEFENSES, COLONY, hiveMaxBees } from './data.js';

export class HornetChief {
  constructor(d) {
    this.n = d?.n ?? [0, 0, 0, 0, 0, 0];      // essais par secteur
    this.mean = d?.mean ?? [0, 0, 0, 0, 0, 0]; // récompense moyenne
    this.t = d?.t ?? 0;
    this.pending = Array.from({ length: 6 }, () => ({ sum: 0, k: 0 }));
  }
  ucb(i) { return this.n[i] === 0 ? Infinity : this.mean[i] + 0.9 * Math.sqrt(Math.log(this.t + 1) / this.n[i]); }
  // Choisit un secteur principal (et un secondaire pour les grosses vagues).
  choose(wave) {
    const scores = [0, 1, 2, 3, 4, 5].map(i => ({ i, s: this.ucb(i) + Math.random() * 1e-3 }));
    scores.sort((a, b) => b.s - a.s);
    return { main: scores[0].i, second: wave >= 4 ? scores[1].i : null };
  }
  // Chaque ennemi rapporte ce qu'il a accompli.
  report(sector, reward) { const p = this.pending[sector]; p.sum += reward; p.k++; }
  endWave() {
    const learned = [];
    this.pending.forEach((p, i) => {
      if (!p.k) return;
      const r = p.sum / p.k;
      this.n[i]++; this.t++;
      this.mean[i] += (r - this.mean[i]) / this.n[i];
      learned.push({ i, r });
    });
    this.pending = Array.from({ length: 6 }, () => ({ sum: 0, k: 0 }));
    return learned;
  }
  weakest() {
    let best = -1, v = -1;
    this.mean.forEach((m, i) => { if (this.n[i] && m > v) { v = m; best = i; } });
    return best < 0 ? null : { i: best, name: SECTORS[best], rate: v };
  }
  toJSON() { return { n: this.n, mean: this.mean, t: this.t }; }
}

// Modèle simplifié de la colonie utilisé par la Reine pour « imaginer » l'avenir.
export function planColony(g) {
  const s = g.s, bees = s.bees;
  let flowerRate = 0, dist = 0, nFlowers = 0;
  g.forTiles(t => {
    if (t.flower && t.flower.g >= 1) {
      const f = FLOWERS[t.flower.id];
      flowerRate += f.honey / f.cd; nFlowers++; dist += Math.hypot(t.x, t.y);
    }
  });
  const avgDist = nFlowers ? dist / nFlowers : 2;
  const tripTime = 2 * avgDist / COLONY.beeSpeed + COLONY.collectTime + 0.4;
  const perForager = 1.3 / tripTime; // miel/s rapporté par une butineuse (estimation)

  // Menace : vague en cours ou imminente
  const soon = s.phase === 'wave' || s.timer < 15;
  const threat = g.estimateThreat() * (soon ? 1.3 : 0.6); // dps nécessaire (avec marge)
  let turretDps = 0;
  g.forTiles(t => { if (t.def?.id === 'jar') turretDps += 0.45 * DEFENSES.jar.dmg[t.def.lvl] / DEFENSES.jar.rate[t.def.lvl]; if (t.def?.id === 'thistle') turretDps += DEFENSES.thistle.dps[t.def.lvl] * 0.25; });

  const H = 40, maxBees = hiveMaxBees(s.hiveLvl);
  let best = null;
  for (let f = 0.1; f <= 0.9001; f += 0.1) for (let gd = 0.05; gd <= 0.9001 - f; gd += 0.05) {
    const n = 1 - f - gd; if (n < 0.0499) continue;
    const foragers = bees * f, guards = bees * gd, nurses = bees * n;
    const income = Math.min(foragers * perForager, flowerRate * 1.1);
    const pollenIn = income * 0.45;
    const growth = Math.min(nurses * COLONY.nurseRate, Math.max(0, maxBees - bees) / H, (s.pollen / H + pollenIn) / COLONY.newBeePollen);
    const honeyNet = (income - bees * COLONY.eat - growth * COLONY.newBeeHoney) * H;
    const defense = guards * COLONY.guardDps * 0.7 + turretDps;
    const deficit = Math.max(0, threat - defense);
    const room = Math.max(0, maxBees - bees);
    let u = honeyNet + growth * H * 10 - deficit * 9 + Math.min(guards, 3) * 4;
    if (room < 1) u -= nurses * 3;   // nourrices inutiles si la ruche est pleine
    if (s.honey + honeyNet < 10) u -= 60; // ne jamais affamer la colonie
    if (!best || u > best.u) best = { u, f, g: gd, n, threat, defense, income, growth };
  }
  const why = [];
  if (best.threat > 0) why.push(`menace estimée ${best.threat.toFixed(0)} dps → ${Math.round(best.g * 100)} % de gardiennes`);
  if (best.growth > 0.02 && best.n > 0.15) why.push('la ruche a de la place : on élève des larves');
  if (best.income < 0.3) why.push('peu de fleurs écloses : plante pour nourrir la colonie');
  else why.push(`récolte estimée ${(best.income * 60).toFixed(0)} 🍯/min`);
  best.why = why.join(' · ');
  return best;
}
