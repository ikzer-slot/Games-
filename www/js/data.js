// Données de jeu : cultures, gardiens (tours), nuisibles, villageois.
export const COLS = 8;
export const ROWS = 12;

export const ITEMS = {
  carrot:  { name: 'Carottes',    emoji: '🥕', base: 7 },
  seed:    { name: 'Graines',     emoji: '🌰', base: 2 },
  pepper:  { name: 'Piments',     emoji: '🌶️', base: 5 },
  pumpkin: { name: 'Citrouilles', emoji: '🎃', base: 28 },
};
export const ITEM_KEYS = Object.keys(ITEMS);

export const CROPS = {
  carrot:    { name: 'Carotte',    emoji: '🥕', cost: 4,  grow: 14, yield: 2, item: 'carrot',  desc: 'Pousse vite, se vend bien.' },
  sunflower: { name: 'Tournesol',  emoji: '🌻', cost: 5,  grow: 18, yield: 5, item: 'seed',    desc: 'Graines = munitions du Graineur. Booste les Ruches voisines.' },
  pepper:    { name: 'Piment',     emoji: '🌶️', cost: 9,  grow: 24, yield: 3, item: 'pepper',  desc: 'Munitions du Brûle-piment.' },
  pumpkin:   { name: 'Citrouille', emoji: '🎃', cost: 14, grow: 34, yield: 1, item: 'pumpkin', desc: 'Munitions de la Catapulte. Très chère au marché.' },
};

// dmgType : phys | fire | expl | poison
export const TOWERS = {
  scarecrow: {
    name: 'Épouvantail', icon: '👒', color: '#c9a66b', cost: 20,
    range: [1.7, 2.0, 2.4], slow: [0.35, 0.45, 0.55], ammo: null,
    desc: 'Ralentit les nuisibles et protège les cultures autour (anti-grignotage). Sans munitions.',
  },
  seeder: {
    name: 'Graineur', icon: '🌻', color: '#e7b53b', cost: 35,
    range: [2.5, 2.8, 3.1], rate: [0.55, 0.45, 0.38], dmg: [4, 7, 11], dmgType: 'phys',
    ammo: 'seed', perAmmo: 3, hitsAir: true,
    desc: 'Tire des graines. 1 graine = 3 tirs.',
  },
  flamer: {
    name: 'Brûle-piment', icon: '🔥', color: '#e2553d', cost: 55,
    range: [1.6, 1.8, 2.0], rate: [0.6, 0.55, 0.5], dmg: [4, 7, 11], dmgType: 'fire',
    ammo: 'pepper', perAmmo: 6, hitsAir: true, aura: true,
    desc: 'Souffle de feu sur tous les nuisibles proches + brûlure. 1 piment = 6 souffles.',
  },
  catapult: {
    name: 'Catapulte', icon: '🎃', color: '#d9822b', cost: 80,
    range: [3.4, 3.8, 4.2], rate: [2.4, 2.1, 1.8], dmg: [24, 40, 62], dmgType: 'expl',
    ammo: 'pumpkin', perAmmo: 3, hitsAir: false, splash: 1.1,
    desc: 'Lance des citrouilles explosives (zone). Ne touche pas les volants. 1 citrouille = 3 tirs.',
  },
  hive: {
    name: 'Ruche', icon: '🐝', color: '#f4c542', cost: 60,
    range: [2.1, 2.4, 2.7], rate: [0.45, 0.38, 0.32], dmg: [1.5, 2.5, 3.5], dmgType: 'poison',
    ammo: null, hitsAir: true,
    desc: 'Abeilles empoisonnées, sans munitions. +35% par Tournesol mûr adjacent.',
  },
};
export const UPGRADE_MULT = [0, 0.9, 1.6]; // coût pour passer au niveau suivant = cost * mult[lvl]

export const ENEMIES = {
  caterpillar: { name: 'Chenille',    emoji: '🐛', hp: 22, speed: 0.75, reward: 3, from: 1 },
  rat:         { name: 'Rat',         emoji: '🐀', hp: 14, speed: 1.35, reward: 3, from: 1 },
  crow:        { name: 'Corbeau',     emoji: '🐦', hp: 15, speed: 1.15, reward: 4, from: 2, flying: true },
  snail:       { name: 'Escargot',    emoji: '🐌', hp: 55, speed: 0.5,  reward: 6, from: 3, armor: 1.5 },
  ladybug:     { name: 'Coccinelle',  emoji: '🐞', hp: 38, speed: 0.95, reward: 5, from: 4 },
  boar:        { name: 'Sanglier',    emoji: '🐗', hp: 380, speed: 0.5, reward: 60, boss: true, barnDmg: 5 },
};

export const VILLAGERS = [
  { who: 'Mamie Odette', emoji: '👵' },
  { who: 'Le boulanger', emoji: '👨‍🍳' },
  { who: "L'école du village", emoji: '🏫' },
  { who: 'La maréchale-ferrante', emoji: '🐴' },
  { who: 'Le restaurant Lune', emoji: '🍲' },
  { who: 'Le fermier voisin', emoji: '🧑‍🌾' },
];

export const MARKET_EVENTS = [
  { text: 'Fête des citrouilles au village !', item: 'pumpkin', mod: 1.8 },
  { text: 'Les chevaux raffolent des carottes cette semaine.', item: 'carrot', mod: 1.6 },
  { text: 'Une épicerie fine cherche des piments.', item: 'pepper', mod: 1.7 },
  { text: 'Les oiseaux ont pillé les graines du voisin.', item: 'seed', mod: 2.0 },
  { text: 'Surproduction de carottes dans la vallée…', item: 'carrot', mod: 0.6 },
  { text: 'Soupe de citrouille passée de mode.', item: 'pumpkin', mod: 0.7 },
];

export const DAMAGE_LABEL = { phys: 'physiques', fire: 'de feu', expl: 'explosifs', poison: 'de poison' };
