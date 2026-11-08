// L'Essaim : une IA évolutionnaire (algorithme génétique) qui fait évoluer
// l'ADN des nuisibles chaque nuit en fonction de ce qui a marché contre toi.
import { ENEMIES, DAMAGE_LABEL } from './data.js';

export const TRAITS = ['vigor', 'haste', 'shell', 'resPhys', 'resFire', 'resExpl', 'resPoison', 'hunger'];
export const TRAIT_LABEL = {
  vigor: 'Vigueur', haste: 'Vitesse', shell: 'Carapace', resPhys: 'Rés. physique',
  resFire: 'Rés. feu', resExpl: 'Rés. explosions', resPoison: 'Rés. poison', hunger: 'Gloutonnerie',
};
const RES_FOR = { phys: 'resPhys', fire: 'resFire', expl: 'resExpl', poison: 'resPoison' };
const POP = 6;

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
function weightedPick(weights) {
  const keys = Object.keys(weights);
  let sum = keys.reduce((s, k) => s + weights[k], 0);
  let r = Math.random() * sum;
  for (const k of keys) { r -= weights[k]; if (r <= 0) return k; }
  return keys[keys.length - 1];
}

export class Swarm {
  constructor(data) {
    this.gen = data?.gen ?? 1;
    this.pops = data?.pops ?? {};
    this.dmg = { phys: 0, fire: 0, expl: 0, poison: 0 };
    this.lastReport = data?.lastReport ?? null;
    this.speciesFit = data?.speciesFit ?? {};
  }

  budget(night) { return Math.floor(1 + night * 1.15); }

  emptyGenome() { const g = {}; TRAITS.forEach(t => g[t] = 0); g.fit = 0; g.n = 0; return g; }

  randomGenome(night) {
    const g = this.emptyGenome();
    for (let i = 0; i < this.budget(night); i++) g[rnd(TRAITS)]++;
    return g;
  }

  ensure(species, night) {
    if (!this.pops[species]) this.pops[species] = Array.from({ length: POP }, () => this.randomGenome(night));
  }

  pick(species, night) {
    this.ensure(species, night);
    const pop = this.pops[species];
    // On fait tourner pour évaluer chaque génome au moins une fois.
    let best = 0;
    for (let i = 1; i < pop.length; i++) if (pop[i].n < pop[best].n) best = i;
    return best;
  }

  // Convertit les gènes en statistiques concrètes.
  express(species, idx, night) {
    const base = ENEMIES[species];
    const g = this.pops[species][idx];
    const nightMul = 1 + 0.13 * (night - 1);
    return {
      maxHp: base.hp * nightMul * (1 + 0.14 * g.vigor),
      speed: base.speed * Math.min(1.8, 1 + 0.06 * g.haste),
      armor: (base.armor || 0) + 0.6 * g.shell,
      res: {
        phys: Math.min(0.7, 0.1 * g.resPhys),
        fire: Math.min(0.7, 0.1 * g.resFire),
        expl: Math.min(0.7, 0.1 * g.resExpl),
        poison: Math.min(0.7, 0.1 * g.resPoison),
      },
      hunger: Math.min(0.85, 0.18 + 0.07 * g.hunger),
    };
  }

  recordDamage(type, amount) { if (this.dmg[type] !== undefined) this.dmg[type] += amount; }

  recordFitness(species, idx, fitness) {
    const g = this.pops[species]?.[idx];
    if (!g) return;
    g.fit += fitness; g.n++;
  }

  // Poids d'apparition : l'Essaim envoie davantage les espèces qui ont réussi.
  spawnWeights(night) {
    const w = {};
    for (const [k, e] of Object.entries(ENEMIES)) {
      if (e.boss || e.from > night) continue;
      w[k] = 1 + 2 * (this.speciesFit[k] ?? 0.3);
    }
    return w;
  }

  avgTraits() {
    const sum = this.emptyGenome(); let n = 0;
    for (const pop of Object.values(this.pops)) for (const g of pop) { TRAITS.forEach(t => sum[t] += g[t]); n++; }
    if (n) TRAITS.forEach(t => sum[t] /= n);
    return sum;
  }

  resistanceProfile() {
    const a = this.avgTraits();
    return { phys: Math.min(0.7, a.resPhys * 0.1), fire: Math.min(0.7, a.resFire * 0.1), expl: Math.min(0.7, a.resExpl * 0.1), poison: Math.min(0.7, a.resPoison * 0.1) };
  }

  // Évolution de fin de nuit : sélection, croisement, mutation dirigée.
  evolve(nextNight) {
    const before = this.avgTraits();
    const totalDmg = Object.values(this.dmg).reduce((a, b) => a + b, 0) || 1;
    const share = {}; for (const k in this.dmg) share[k] = this.dmg[k] / totalDmg;

    // Pression de sélection : quels gènes favoriser ?
    const pressure = {};
    TRAITS.forEach(t => pressure[t] = 1);
    for (const k in share) pressure[RES_FOR[k]] += share[k] * 6;
    pressure.vigor += 1; pressure.haste += 0.6;

    const bestSpecies = { k: null, f: -1 };
    const budget = this.budget(nextNight);

    for (const [species, pop] of Object.entries(this.pops)) {
      pop.forEach(g => g.score = g.n ? g.fit / g.n : 0);
      pop.sort((a, b) => b.score - a.score);
      const avg = pop.reduce((s, g) => s + g.score, 0) / pop.length;
      this.speciesFit[species] = Math.round(avg * 100) / 100;
      if (avg > bestSpecies.f) bestSpecies.k = species, bestSpecies.f = avg;

      const elites = pop.slice(0, 2).map(g => ({ ...g }));
      const parents = pop.slice(0, 3);
      const next = [...elites];
      while (next.length < POP) {
        const a = rnd(parents), b = rnd(parents);
        const child = this.emptyGenome();
        TRAITS.forEach(t => child[t] = Math.random() < 0.5 ? a[t] : b[t]);
        // Mutation : déplacer 1-2 points vers les traits sous pression.
        for (let m = 0; m < 1 + (Math.random() < 0.5 ? 1 : 0); m++) {
          const from = rnd(TRAITS.filter(t => child[t] > 0));
          if (from) { child[from]--; child[weightedPick(pressure)]++; }
        }
        next.push(child);
      }
      // Ajustement au budget de la nuit suivante (points en plus guidés par la pression).
      for (const g of next) {
        let total = TRAITS.reduce((s, t) => s + g[t], 0);
        while (total < budget) { g[Math.random() < 0.65 ? weightedPick(pressure) : rnd(TRAITS)]++; total++; }
        while (total > budget) { const t = rnd(TRAITS.filter(x => g[x] > 0)); g[t]--; total--; }
        g.fit = 0; g.n = 0; delete g.score;
      }
      this.pops[species] = next;
    }

    const after = this.avgTraits();
    const deltas = TRAITS.map(t => ({ t, d: after[t] - before[t] })).sort((a, b) => b.d - a.d);
    const domType = Object.keys(share).sort((a, b) => share[b] - share[a])[0];
    const lines = [];
    if (totalDmg > 1) lines.push(`Tu as infligé ${Math.round(share[domType] * 100)}% de dégâts ${DAMAGE_LABEL[domType]} → l'Essaim développe sa ${TRAIT_LABEL[RES_FOR[domType]].toLowerCase()}.`);
    if (deltas[0].d > 0.05) lines.push(`Gène en plein essor : ${TRAIT_LABEL[deltas[0].t]} (+${deltas[0].d.toFixed(1)}).`);
    if (bestSpecies.k) lines.push(`Espèce la plus efficace : ${ENEMIES[bestSpecies.k].emoji} ${ENEMIES[bestSpecies.k].name} → elle sera plus nombreuse.`);
    lines.push(diversityTip(share));

    this.gen++;
    this.lastReport = { gen: this.gen, lines, share, res: this.resistanceProfile(), traits: after };
    this.dmg = { phys: 0, fire: 0, expl: 0, poison: 0 };
    return this.lastReport;
  }

  toJSON() { return { gen: this.gen, pops: this.pops, lastReport: this.lastReport, speciesFit: this.speciesFit }; }
}

function diversityTip(share) {
  const used = Object.values(share).filter(v => v > 0.1).length;
  if (used <= 1) return 'Conseil : une seule arme = un Essaim qui s\'adapte vite. Diversifie tes Gardiens !';
  if (used >= 3) return 'Ta défense est variée : l\'Essaim a du mal à s\'adapter. Bravo !';
  return 'Ajouter un nouveau type de dégâts ralentirait l\'adaptation de l\'Essaim.';
}
