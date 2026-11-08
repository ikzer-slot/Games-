import type { Anchor } from './types';

/** "Lycée Ampère (Saxe)" -> "lycee-ampere-saxe" : clé stable, sans accents ni casse. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Clé de pré-filtrage côté serveur : deux ancrages ne peuvent être comparés que
 * s'ils ont la même matchKey. Doit rester identique à la colonne générée
 * `anchors.match_key` du schéma SQL.
 */
export function matchKey(a: Pick<Anchor, 'kind' | 'cityKey' | 'subjectKey'>): string {
  return `${a.kind}:${a.subjectKey ?? a.cityKey ?? ''}`;
}

export function isComplete(a: Anchor): boolean {
  switch (a.kind) {
    case 'city':
      return !!a.cityKey;
    case 'school':
    case 'work':
      return !!a.cityKey && !!a.subjectKey;
    case 'ancestor_job':
    case 'club':
    case 'event':
      return !!a.subjectKey;
  }
}

export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
