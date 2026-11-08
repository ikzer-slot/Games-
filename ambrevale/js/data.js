'use strict';
/* ==========================================================================
   AMBREVALE — données de jeu (bâtiments, unités, sorts, quêtes)
   ========================================================================== */

// ?dev=60 dans l'URL accélère le temps (tests uniquement)
const DEV = (() => { const m = /[?&]dev=(\d+)/.exec(location.search); return m ? Math.max(1, +m[1]) : 1; })();

const MAP_N = 26;                 // taille de la grille
const TW = 64, TH = 32, HW = 32, HH = 16;
// secondes pour atteindre le niveau i (index = niveau visé)
const TIME_TABLE = [0, 10, 60, 300, 1200, 3600, 10800, 21600, 43200, 72000, 108000];
const HORN_MAX = 3, HORN_REGEN = 7200;   // cornes de guerre : 1 toutes les 2 h
const BATTLE_TIME = 180;

function geo(base, g, l) { return base * Math.pow(g, l - 1); }
function niceRound(n) {
  if (n < 100) return Math.round(n / 5) * 5;
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n < 10000) return Math.round(n / 50) * 50;
  if (n < 100000) return Math.round(n / 500) * 500;
  return Math.round(n / 5000) * 5000;
}

const BUILDINGS = {
  citadel: {
    name: 'Citadelle', size: 3, maxLvl: 8, cat: 'core', tf: 1.6, costRes: 'gold',
    cost: l => [0, 0, 1200, 5000, 18000, 60000, 160000, 400000, 900000][l] || 0,
    hp: l => 1600 + l * 900, store: l => 1500 * l,
    atk: { dmg: l => 9 * geo(1, 1.28, l), range: 5.5, rate: 1.0, air: true, ground: true, proj: 'arrow', z: 64 },
    desc: "Le cœur d'Ambrevale. Son niveau débloque de nouveaux bâtiments et de nouveaux niveaux. Si elle tombe, l'assaut est perdu."
  },
  goldmine: {
    name: "Mine d'or", size: 2, maxLvl: 9, cat: 'resource', tf: 0.8, costRes: 'sap',
    cost: l => niceRound(geo(150, 1.95, l)), hp: l => 320 * geo(1, 1.2, l),
    prod: 'gold', rate: l => Math.round(geo(240, 1.42, l)), cap: l => Math.round(geo(240, 1.42, l) * 6),
    desc: "Extrait de l'or en continu, même en votre absence. Revenez le récolter avant qu'elle ne déborde."
  },
  sapwell: {
    name: 'Puits de sève', size: 2, maxLvl: 9, cat: 'resource', tf: 0.8, costRes: 'gold',
    cost: l => niceRound(geo(150, 1.95, l)), hp: l => 320 * geo(1, 1.2, l),
    prod: 'sap', rate: l => Math.round(geo(240, 1.42, l)), cap: l => Math.round(geo(240, 1.42, l) * 6),
    desc: 'Puise la sève violette des racines anciennes. Elle sert à entraîner vos troupes et à bâtir.'
  },
  goldvault: {
    name: "Coffre d'or", size: 2, maxLvl: 9, cat: 'resource', tf: 0.9, costRes: 'sap',
    cost: l => niceRound(geo(300, 2.05, l)), hp: l => 520 * geo(1, 1.22, l),
    storeGold: l => niceRound(geo(2500, 2.0, l)),
    desc: "Augmente la quantité d'or que vous pouvez conserver."
  },
  sapvault: {
    name: 'Réservoir de sève', size: 2, maxLvl: 9, cat: 'resource', tf: 0.9, costRes: 'gold',
    cost: l => niceRound(geo(300, 2.05, l)), hp: l => 520 * geo(1, 1.22, l),
    storeSap: l => niceRound(geo(2500, 2.0, l)),
    desc: 'Augmente la quantité de sève que vous pouvez conserver.'
  },
  barracks: {
    name: 'Caserne', size: 2, maxLvl: 7, cat: 'army', tf: 1, costRes: 'sap',
    cost: l => niceRound(geo(200, 2.4, l)), hp: l => 420 * geo(1, 1.2, l),
    desc: 'Entraîne vos troupes. Chaque niveau débloque une nouvelle unité. Plusieurs casernes entraînent plus vite.'
  },
  camp: {
    name: 'Campement', size: 2, maxLvl: 8, cat: 'army', tf: 0.8, costRes: 'sap',
    cost: l => niceRound(geo(250, 2.1, l)), hp: l => 300 * geo(1, 1.2, l),
    housing: l => 15 + (l - 1) * 6,
    desc: "Abrite vos troupes. Augmente la taille maximale de l'armée."
  },
  archer: {
    name: "Tour d'archers", size: 2, maxLvl: 9, cat: 'defense', tf: 1, costRes: 'gold',
    cost: l => niceRound(geo(300, 1.95, l)), hp: l => 380 * geo(1, 1.22, l),
    atk: { dmg: l => 13 * geo(1, 1.3, l), range: 6.5, rate: 0.8, air: true, ground: true, proj: 'arrow' },
    desc: 'Tir rapide à longue portée. Touche les cibles au sol et dans les airs.'
  },
  cannon: {
    name: 'Canon', size: 2, maxLvl: 9, cat: 'defense', tf: 1, costRes: 'gold',
    cost: l => niceRound(geo(400, 1.95, l)), hp: l => 460 * geo(1, 1.22, l),
    atk: { dmg: l => 34 * geo(1, 1.3, l), range: 5.5, rate: 1.6, air: false, ground: true, splash: 1.1, proj: 'ball' },
    desc: 'Boulets dévastateurs à dégâts de zone. Ne peut pas viser les créatures volantes.'
  },
  arcane: {
    name: 'Tour arcanique', size: 2, maxLvl: 9, cat: 'defense', tf: 1.1, costRes: 'sap',
    cost: l => niceRound(geo(900, 1.95, l)), hp: l => 420 * geo(1, 1.22, l),
    atk: { dmg: l => 40 * geo(1, 1.3, l), range: 5.5, rate: 1.4, air: true, ground: true, magic: true, chain: 2, proj: 'bolt' },
    desc: "Éclairs magiques qui ignorent l'armure et rebondissent sur deux ennemis proches."
  },
  frost: {
    name: 'Obélisque de givre', size: 2, maxLvl: 9, cat: 'defense', tf: 1.1, costRes: 'sap',
    cost: l => niceRound(geo(1500, 1.95, l)), hp: l => 500 * geo(1, 1.22, l),
    atk: { dmg: l => 5 * geo(1, 1.3, l), range: 4, rate: 0.5, air: true, ground: true, magic: true, aura: true, slow: l => Math.min(0.7, 0.32 + 0.045 * l) },
    desc: 'Émet une aura glaciale qui ralentit tous les ennemis à portée.'
  },
  wall: {
    name: 'Muraille', size: 1, maxLvl: 8, cat: 'wall', tf: 0, costRes: 'gold', instant: true,
    cost: l => niceRound(geo(50, 2.25, l)), hp: l => 500 * geo(1, 1.45, l),
    desc: 'Force les ennemis à la briser ou à la contourner. Construction et amélioration instantanées.'
  }
};

// nombre maximum de chaque bâtiment selon le niveau de la Citadelle (index = niveau)
const LIMITS = {
  citadel: [0, 1, 1, 1, 1, 1, 1, 1, 1],
  goldmine: [0, 1, 2, 2, 3, 3, 4, 4, 5],
  sapwell: [0, 1, 2, 2, 3, 3, 4, 4, 5],
  goldvault: [0, 1, 1, 2, 2, 2, 3, 3, 3],
  sapvault: [0, 1, 1, 2, 2, 2, 3, 3, 3],
  barracks: [0, 1, 1, 1, 2, 2, 2, 3, 3],
  camp: [0, 1, 1, 2, 2, 3, 3, 4, 4],
  archer: [0, 1, 2, 2, 3, 3, 4, 4, 5],
  cannon: [0, 0, 1, 2, 2, 3, 3, 4, 4],
  arcane: [0, 0, 0, 1, 1, 2, 2, 3, 3],
  frost: [0, 0, 0, 0, 1, 1, 2, 2, 2],
  wall: [0, 25, 50, 75, 100, 125, 150, 175, 200]
};

const UNITS = {
  marauder: { name: 'Maraudeur', hp: 70, dmg: 11, rate: 1.0, speed: 1.05, range: 0.55, housing: 1, cost: 25, time: 20, goal: 'any', color: '#d9824b', unlock: 1, threat: 1, size: 6,
    desc: 'Guerrier polyvalent, attaque le bâtiment le plus proche.' },
  scout: { name: 'Éclaireur', hp: 38, dmg: 7, rate: 0.7, speed: 1.9, range: 0.55, housing: 1, cost: 30, time: 18, goal: 'resource', color: '#7fc46a', unlock: 2, threat: 2, size: 5,
    desc: 'Très rapide. Vise en priorité les ressources.' },
  archerU: { name: 'Archère', hp: 34, dmg: 10, rate: 1.0, speed: 1.1, range: 3.2, ranged: true, housing: 1, cost: 45, time: 30, goal: 'any', color: '#e7c86a', unlock: 3, threat: 3, size: 5,
    desc: 'Tire par-dessus les murailles à distance.' },
  sapper: { name: 'Sapeur', hp: 45, dmg: 40, rate: 1, wallMult: 8, speed: 1.5, range: 0.5, housing: 2, suicide: true, splash: 1.3, cost: 120, time: 60, goal: 'wall', color: '#c9c9c9', unlock: 4, threat: 4, size: 5,
    desc: 'Se fait exploser contre les murailles (dégâts x8).' },
  brute: { name: 'Colosse', hp: 420, dmg: 26, rate: 1.6, speed: 0.62, range: 0.7, armor: 0.35, housing: 5, cost: 260, time: 150, goal: 'defense', color: '#8a6fc9', unlock: 5, threat: 5, size: 10,
    desc: 'Énorme et cuirassé (-35 % de dégâts physiques). Fonce sur les défenses.' },
  shaman: { name: 'Chamane', hp: 110, dmg: 0, heal: 16, rate: 1, speed: 0.95, range: 2.2, housing: 3, healer: true, cost: 220, time: 120, goal: 'ally', color: '#5fe0c0', unlock: 6, threat: 7, size: 6,
    desc: 'Soigne les alliés proches. Ne combat pas.' },
  wyvern: { name: 'Wyverne', hp: 220, dmg: 22, rate: 1.3, speed: 1.25, range: 1.6, air: true, housing: 4, splash: 0.8, cost: 340, time: 200, goal: 'any', color: '#e05a6a', unlock: 7, threat: 6, size: 8,
    desc: 'Créature volante, survole les murailles. Insensible aux canons.' }
};
const UNIT_ORDER = ['marauder', 'scout', 'archerU', 'sapper', 'brute', 'shaman', 'wyvern'];

const SPELLS = {
  bolt: { name: 'Foudre', charges: 3, radius: 1.7, dmg: cl => 100 * geo(1, 1.25, cl), cl: 1, desc: 'Frappe une zone de la foudre céleste.' },
  frost: { name: 'Gel', charges: 2, radius: 2.3, freeze: 3.5, cl: 3, desc: 'Fige les ennemis dans la glace.' }
};

const QUESTS = {
  collect_gold: { text: n => `Récolter ${fmtNum(n)} or`, n: cl => 800 * cl, track: 'collectGold', gems: 4 },
  collect_sap: { text: n => `Récolter ${fmtNum(n)} sève`, n: cl => 800 * cl, track: 'collectSap', gems: 4 },
  win_def: { text: n => `Repousser ${n} assauts`, n: () => 2, track: 'defWin', gems: 8 },
  upgrade: { text: n => `Lancer ${n} constructions ou améliorations`, n: () => 2, track: 'upgrade', gems: 5 },
  train: { text: n => `Entraîner ${n} troupes`, n: cl => 8 + cl * 2, track: 'train', gems: 5 },
  stars: { text: n => `Gagner ${n} étoiles en expédition`, n: () => 3, track: 'stars', gems: 8 },
  spell: { text: n => `Lancer ${n} sorts en défense`, n: () => 4, track: 'spell', gems: 4 },
  kill: { text: n => `Vaincre ${n} ennemis`, n: cl => 25 + cl * 10, track: 'kill', gems: 6 }
};
const DAILY_GEMS = [3, 4, 5, 6, 8, 10, 20];
const BUILDER_COST = [0, 0, 0, 250, 600, 1200];
const SHOP = [
  { id: 'defense', name: 'Défenses', items: ['archer', 'cannon', 'arcane', 'frost', 'wall'] },
  { id: 'resource', name: 'Ressources', items: ['goldmine', 'sapwell', 'goldvault', 'sapvault'] },
  { id: 'army', name: 'Armée', items: ['barracks', 'camp'] }
];
const SIDE_NAMES = ['Nord-Est', 'Sud-Est', 'Sud-Ouest', 'Nord-Ouest'];
const B_HEIGHT = { citadel: 118, goldmine: 60, sapwell: 62, goldvault: 42, sapvault: 56, barracks: 62, camp: 32, archer: 78, cannon: 36, arcane: 104, frost: 74, wall: 26 };
