/**
 * Pseudonymes anonymes et stables, dérivés de l'identifiant opaque.
 * Tant que les deux personnes n'ont pas accepté, c'est tout ce qu'on montre.
 * (Le même identifiant donne toujours le même pseudonyme, pour pouvoir le
 * reconnaître d'une session à l'autre sans rien révéler.)
 */
const NOUNS = ['Luciole', 'Lanterne', 'Comète', 'Braise', 'Boussole', 'Héron', 'Phare', 'Galet', 'Saule', 'Étoile', 'Mésange', 'Fanal'];
const SHADES = ['ambre', 'cuivre', 'opale', 'indigo', 'safran', 'céladon', 'ocre', 'nacre', 'corail', 'sauge', 'lilas', 'bronze'];

export function hashString(input: string): number {
  // FNV-1a 32 bits
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function anonymousName(id: string): string {
  const h = hashString(id);
  return `${NOUNS[h % NOUNS.length]} ${SHADES[(h >>> 8) % SHADES.length]}`;
}

/** Nom affiché : le pseudo réel uniquement s'il a été révélé (accord mutuel). */
export function displayName(id: string, revealedPseudo?: string): string {
  return revealedPseudo ?? anonymousName(id);
}
