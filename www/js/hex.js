// Outils de grille hexagonale (coordonnées axiales, hexagones « pointe en haut »).
// Monde : 1 unité = distance entre deux centres voisins.
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const key = (q, r) => q + ',' + r;
export const hexDist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
export const toWorld = (q, r) => ({ x: q + r / 2, y: r * 0.8660254 });
export function fromWorld(x, y) {
  const r = y / 0.8660254, q = x - r / 2;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs + q + r);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}
export function ring(radius) {
  const out = [];
  let q = -radius, r = radius; // départ au sud-ouest
  for (let side = 0; side < 6; side++) for (let i = 0; i < radius; i++) {
    out.push({ q, r });
    q += DIRS[side][0]; r += DIRS[side][1];
  }
  return out;
}
// Secteur (0..5) d'une position monde autour du centre, 0 = nord-est puis sens horaire.
export function sectorOf(x, y) {
  let a = Math.atan2(y, x) * 180 / Math.PI; // 0 = est, sens horaire car y vers le bas
  a = (a + 90 + 360) % 360;                 // 0 = nord
  return Math.floor(a / 60) % 6;
}
export const sectorAngle = (s) => (s * 60 + 30 - 90) * Math.PI / 180; // centre du secteur
