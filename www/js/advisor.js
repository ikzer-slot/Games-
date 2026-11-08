// Gaïa : l'assistante IA du potager.
// - Mode local (hors-ligne) : moteur de règles qui analyse la partie en temps réel.
// - Mode connecté (optionnel) : envoie un résumé de la partie à un proxy qui interroge Claude.
import { TOWERS, CROPS, ITEMS, ITEM_KEYS, DAMAGE_LABEL } from './data.js';

export function summarize(g) {
  const towers = {}, crops = {}; let mature = 0, exposed = 0;
  g.forCells((cell, r, c) => {
    if (cell.tower) towers[cell.tower.id] = (towers[cell.tower.id] || 0) + 1;
    if (cell.crop) {
      crops[cell.crop.id] = (crops[cell.crop.id] || 0) + 1;
      if (cell.crop.g >= 1) mature++;
      if (g.isNearPath(r, c) && !g.isGuarded(r, c)) exposed++;
    }
  });
  return {
    jour: g.s.day, phase: g.s.phase, pieces: Math.floor(g.s.coins), coeurs: g.s.hearts,
    reputation: g.s.rep, stock: g.s.stock, gardiens: towers, cultures: crops,
    culturesMures: mature, culturesExposees: exposed,
    resistancesEssaim: g.swarm.resistanceProfile(),
    prixMarche: Object.fromEntries(ITEM_KEYS.map(k => [k, Math.round(g.price(k))])),
    commandes: g.s.orders.map(o => `${o.qty} ${ITEMS[o.item].name} (${o.reward}🪙)`),
    robots: g.s.robots.length,
  };
}

export function localTip(g) {
  const s = g.s, sum = summarize(g), tips = [];
  const nT = Object.values(sum.gardiens).reduce((a, b) => a + b, 0);

  if (nT === 0) tips.push([10, "Aucun Gardien ! Construis un Graineur (onglet 🛡️) juste à côté du chemin avant la nuit."]);
  for (const [id, n] of Object.entries(sum.gardiens)) {
    const def = TOWERS[id];
    if (def.ammo && s.stock[def.ammo] < 3 * n) {
      const crop = Object.entries(CROPS).find(([, c]) => c.item === def.ammo)?.[1];
      tips.push([9, `Tes ${def.name}s vont manquer de ${ITEMS[def.ammo].name.toLowerCase()} (${s.stock[def.ammo]} en stock). Plante des ${crop.name.toLowerCase()}s ou achète-en au marché.`]);
    }
  }
  if (sum.culturesMures >= 4) tips.push([6, `${sum.culturesMures} cultures sont mûres : glisse ton doigt dessus pour tout récolter d'un coup !`]);
  if (sum.culturesExposees >= 2) tips.push([5, `${sum.culturesExposees} cultures longent le chemin sans protection. Un Épouvantail limiterait le grignotage.`]);
  const res = sum.resistancesEssaim;
  const top = Object.keys(res).sort((a, b) => res[b] - res[a])[0];
  if (res[top] >= 0.2) {
    const counter = Object.values(TOWERS).filter(t => t.dmgType && t.dmgType !== top).map(t => t.name).join(', ');
    tips.push([8, `L'Essaim résiste désormais à ${Math.round(res[top] * 100)}% aux dégâts ${DAMAGE_LABEL[top]}. Mise sur : ${counter}.`]);
  }
  for (const k of ITEM_KEYS) {
    const m = g.mult(k);
    if (m > 1.35 && s.stock[k] > 3) tips.push([7, `Le prix des ${ITEMS[k].name.toLowerCase()} est haut (x${m.toFixed(1)}) : c'est le moment de vendre au marché 🏪.`]);
  }
  for (const o of s.orders) if (s.stock[o.item] >= o.qty) tips.push([8, `${o.emoji} ${o.who} attend ${o.qty} ${ITEMS[o.item].name.toLowerCase()} et tu les as : livre la commande !`]);
  if (s.robots.length === 0 && s.coins > 140 && s.day >= 3) tips.push([6, 'Tu as de quoi engager un Robot-jardinier 🤖 : il récolte et replante tout seul.']);
  if (s.coins > 200) tips.push([4, 'Tes pièces dorment ! Améliore un Gardien (touche-le) ou agrandis ton silo.']);
  if (s.hearts <= 6) tips.push([9, 'La grange est fragile ! Concentre tes Gardiens sur la fin du chemin.']);
  if (s.phase === 'day' && s.dayTime > s.dayLen * 0.8) tips.push([3, 'La nuit approche… Lance-la plus tôt avec 🌙 pour gagner un bonus.']);
  tips.push([1, 'Astuce : les cultures près de l\'eau 💧 poussent 50% plus vite.']);
  tips.push([1, 'Astuce : une Ruche entourée de Tournesols mûrs devient redoutable.']);
  tips.push([1, 'Astuce : les Corbeaux 🐦 volent — la Catapulte ne peut pas les toucher.']);

  tips.sort((a, b) => b[0] - a[0]);
  // Évite de répéter le même conseil deux fois de suite.
  const pick = tips.find(t => t[1] !== g.lastTip) || tips[0];
  g.lastTip = pick[1];
  return pick[1];
}

export async function askGaia(g, question) {
  const url = g.settings.aiUrl?.trim();
  if (!url) return { text: localTip(g), source: 'local' };
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: summarize(g), question: question || null }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.tip) throw new Error('vide');
    return { text: data.tip, source: 'claude' };
  } catch (e) {
    return { text: localTip(g), source: 'local' };
  }
}
