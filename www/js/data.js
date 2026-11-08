// Équilibrage de Miel & Dards.
export const RADIUS = 4;

export const FLOWERS = {
  daisy:     { name: 'Pâquerette', emoji: '🌼', cost: 5,  grow: 10, honey: 0.7, pollen: 1.0, cd: 4, desc: 'Pousse vite, riche en pollen (nourrit les larves).' },
  tulip:     { name: 'Tulipe',     emoji: '🌷', cost: 10, grow: 18, honey: 1.5, pollen: 0.3, cd: 5, desc: 'Beaucoup de nectar : la fleur à miel.' },
  sunflower: { name: 'Tournesol',  emoji: '🌻', cost: 18, grow: 30, honey: 2.4, pollen: 1.2, cd: 6, desc: 'Lente mais généreuse en miel et en pollen.' },
  poppy:     { name: 'Pavot',      emoji: '🌺', cost: 22, grow: 20, honey: 0.5, pollen: 0.5, cd: 5, aura: 1.6, slow: 0.45, desc: 'Son parfum endort : ralentit les ennemis proches de 45 %.' },
};

export const DEFENSES = {
  thistle: { name: 'Chardon', emoji: '🌵', cost: 12, blocks: true, range: [1.05, 1.05, 1.05], dps: [4, 7, 11], desc: 'Bloque les ennemis au sol (ils doivent le contourner) et pique ceux qui passent à côté.' },
  jar:     { name: 'Jarre à propolis', emoji: '🏺', cost: 35, blocks: true, range: [2.6, 2.9, 3.2], rate: [1.0, 0.85, 0.7], dmg: [8, 13, 20], slow: 0.3, desc: 'Tire de la propolis collante : dégâts + ralentissement. Touche aussi les volants.' },
  post:    { name: 'Poste de garde', emoji: '🛖', cost: 50, blocks: true, range: [2.2, 2.5, 2.8], desc: 'Les gardiennes se répartissent entre la ruche et les postes pour patrouiller plus loin.' },
  lure:    { name: 'Leurre de miel', emoji: '🍯', cost: 20, blocks: false, honey: 15, range: [3, 3, 3], desc: 'Les volants qui passent près s\'arrêtent pour se gaver de miel (15 🍯 de réserve).' },
};
export const UPGRADE = [1, 0.9, 1.5];

// speed en cases/s
export const ENEMIES = {
  ant:    { name: 'Fourmi',           emoji: '🐜', hp: 18, speed: 0.9, dmg: 1, steal: 3, reward: 2, from: 1 },
  hornet: { name: 'Frelon',           emoji: null, hp: 26, speed: 1.15, dmg: 2, steal: 5, reward: 4, from: 2, flying: true, hunter: true },
  moth:   { name: 'Papillon de nuit', emoji: '🦋', hp: 10, speed: 1.7, dmg: 1, steal: 4, reward: 2, from: 2, flying: true },
  spider: { name: 'Araignée',         emoji: '🕷️', hp: 60, speed: 0.55, dmg: 3, steal: 4, reward: 6, from: 3, armor: 2 },
  bear:   { name: 'Ours',             emoji: '🐻', hp: 520, speed: 0.38, dmg: 10, steal: 30, reward: 60, boss: true, crusher: true },
};

export const SECTORS = ['Nord-Est', 'Est', 'Sud-Est', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];

export const COLONY = {
  eat: 0.018,          // miel consommé par abeille et par seconde
  nurseRate: 0.06,    // abeilles produites par nourrice et par seconde
  newBeeHoney: 1.2, newBeePollen: 0.6,
  beeSpeed: 2.6, collectTime: 1.1,
  guardHp: 6, guardDps: 5,
};
export const hiveMaxBees = (lvl) => 14 + 10 * (lvl - 1);
export const hiveMaxHp = (lvl) => 30 + 10 * (lvl - 1);
export const hiveCap = (lvl) => 160 + 120 * (lvl - 1);
export const hiveUpgradeCost = (lvl) => [0, 90, 180, 320, 520][lvl] ?? 520 + 250 * (lvl - 4);
