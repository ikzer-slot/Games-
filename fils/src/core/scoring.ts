/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  MOTEUR DE LIENS — score de proximité entre deux profils
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Principe : un lien est une somme de « coïncidences ». Chaque coïncidence
 * (une paire d'ancrages : un des miens, un des siens) reçoit un poids entre
 * 0 et 1 qui exprime « à quel point c'est surprenant / significatif ».
 *
 *   poids = BASE[type] × facteurLieu × facteurTemps × facteurRareté   (plafonné à 0,95)
 *
 *  1. BASE[type] — la taille de la « communauté » que représente le type :
 *     une école ou un lieu de travail = petit groupe → poids élevé ;
 *     une ville = grand groupe → poids moyen ; un événement national
 *     (canicule 2003) = des millions de gens → poids faible.
 *
 *  2. facteurLieu — pour les types où la ville est secondaire (métier d'un
 *     grand-parent, club, événement) : même ville = ×1, villes différentes =
 *     ×0,35, ville inconnue d'un côté = ×0,5. (Pour ville/école/travail, la
 *     ville fait partie de l'identité de l'ancrage : toujours ×1.)
 *
 *  3. facteurTemps — « même ville + même année > même ville seulement » :
 *       périodes qui se chevauchent   → ×1,0 à ×1,2 (bonus selon la durée commune)
 *       écart de 1 à 5 ans            → ×0,75 dégressif jusqu'à ×0,43
 *       écart supérieur               → ×0,3
 *       période absente d'un côté     → ×0,5
 *     (fenêtre élargie à 10 ans pour les grands-parents, souvent datés en
 *     décennies ; ×1 pour les événements, qui sont datés par nature.)
 *
 *  4. facteurRareté — type IDF : une coïncidence partagée par peu de profils
 *     de la base compte plus. Varie de ×1 (très rare) à ×0,6 (tout le monde).
 *
 * Agrégation : on apparie chaque ancrage au plus une fois (appariement glouton
 * par poids décroissant), puis on combine comme des probabilités indépendantes :
 *
 *   score = 1 − Π (1 − poidsᵢ)
 *
 * → le score croît avec le nombre de points communs mais sature vers 1 ; deux
 *   coïncidences faibles ne battent pas une coïncidence très forte.
 *
 * Le module est pur (aucune dépendance React/réseau) : il tourne dans l'app,
 * dans les scripts de test et pourra tourner dans une Edge Function.
 */
import { t, type TKey } from '@/i18n';
import { matchKey } from './normalize';
import type { Anchor, AnchorKind, Candidate, RarityTable } from './types';

export type Precision = 'same_time' | 'close' | 'same_place' | 'loose';

export interface AnchorMatch {
  mine: Anchor;
  theirs: Anchor;
  weight: number;
  precision: Precision;
  sameCity: boolean;
  /** Années communes, si les périodes se chevauchent. */
  overlap?: { from: number; to: number };
  /** Écart en années, si les périodes ne se chevauchent pas. */
  gapYears?: number;
}

export interface LinkResult {
  candidateId: string;
  /** 0..1 */
  score: number;
  /** Coïncidences triées de la plus forte à la plus faible. */
  matches: AnchorMatch[];
  /** La phrase « pourquoi » principale (coïncidence la plus forte). */
  why: string;
  /** « Et 2 autres points communs. » (vide s'il n'y en a pas). */
  whyMore: string;
}

export const BASE_WEIGHT: Record<AnchorKind, number> = {
  school: 0.6,
  work: 0.55,
  club: 0.4,
  ancestor_job: 0.35,
  city: 0.3,
  event: 0.15,
};

/** Types pour lesquels la ville est un attribut secondaire (comparé à part). */
const CITY_IS_SECONDARY: AnchorKind[] = ['ancestor_job', 'club', 'event'];
const MAX_PAIR_WEIGHT = 0.95;
const MIN_LINK_SCORE = 0.05;

function period(a: Anchor): { from: number; to: number } | undefined {
  if (a.startYear == null && a.endYear == null) return undefined;
  const from = a.startYear ?? a.endYear!;
  const to = a.endYear ?? a.startYear!;
  return { from: Math.min(from, to), to: Math.max(from, to) };
}

function spatialFactor(mine: Anchor, theirs: Anchor): { factor: number; sameCity: boolean } {
  if (!CITY_IS_SECONDARY.includes(mine.kind)) return { factor: 1, sameCity: true };
  if (!mine.cityKey || !theirs.cityKey) return { factor: 0.5, sameCity: false };
  return mine.cityKey === theirs.cityKey ? { factor: 1, sameCity: true } : { factor: 0.35, sameCity: false };
}

function temporalFactor(
  mine: Anchor,
  theirs: Anchor,
): { factor: number; precision: Precision; overlap?: { from: number; to: number }; gapYears?: number } {
  if (mine.kind === 'event') return { factor: 1, precision: 'same_time' };
  const p1 = period(mine);
  const p2 = period(theirs);
  if (!p1 || !p2) return { factor: 0.5, precision: 'same_place' };

  const from = Math.max(p1.from, p2.from);
  const to = Math.min(p1.to, p2.to);
  if (to >= from) {
    const commonYears = to - from + 1;
    return { factor: 1 + 0.05 * Math.min(commonYears - 1, 4), precision: 'same_time', overlap: { from, to } };
  }
  const gap = from - to;
  const window = mine.kind === 'ancestor_job' ? 10 : 5;
  if (gap <= window) {
    // Décroît linéairement de 0,75 (1 an d'écart) à ~0,43 (bord de la fenêtre).
    const factor = 0.75 - (0.32 * (gap - 1)) / Math.max(window - 1, 1);
    return { factor, precision: 'close', gapYears: gap };
  }
  return { factor: 0.3, precision: 'same_place', gapYears: gap };
}

function rarityFactor(a: Anchor, rarity?: RarityTable): number {
  if (!rarity || rarity.population < 3) return 1;
  const df = rarity.counts[matchKey(a)];
  if (!df || df < 2) return 1;
  // 1 − log(df)/log(N) vaut 1 si seuls deux profils partagent la clé, 0 si tous.
  const idf = 1 - Math.log(df) / Math.log(rarity.population);
  return Math.min(1, Math.max(0.6, 0.6 + 0.4 * idf));
}

/** Compare deux ancrages ; renvoie null s'ils ne désignent pas la même chose. */
export function compareAnchors(mine: Anchor, theirs: Anchor, rarity?: RarityTable): AnchorMatch | null {
  if (!mine.visible || !theirs.visible) return null;
  if (mine.kind !== theirs.kind || matchKey(mine) !== matchKey(theirs)) return null;

  const spatial = spatialFactor(mine, theirs);
  const temporal = temporalFactor(mine, theirs);
  const weight = Math.min(
    MAX_PAIR_WEIGHT,
    BASE_WEIGHT[mine.kind] * spatial.factor * temporal.factor * rarityFactor(mine, rarity),
  );
  const precision: Precision = spatial.sameCity ? temporal.precision : 'loose';
  return {
    mine,
    theirs,
    weight,
    precision,
    sameCity: spatial.sameCity,
    overlap: temporal.overlap,
    gapYears: temporal.gapYears,
  };
}

/** Score complet entre mes ancrages et ceux d'un autre profil. */
export function scoreLink(myAnchors: Anchor[], candidate: Candidate, rarity?: RarityTable): LinkResult | null {
  const pairs: AnchorMatch[] = [];
  for (const mine of myAnchors) {
    for (const theirs of candidate.anchors) {
      const m = compareAnchors(mine, theirs, rarity);
      if (m) pairs.push(m);
    }
  }
  if (pairs.length === 0) return null;

  // Appariement glouton : chaque ancrage (le mien comme le sien) ne compte qu'une fois.
  pairs.sort((a, b) => b.weight - a.weight);
  const usedMine = new Set<string>();
  const usedTheirs = new Set<string>();
  const matches: AnchorMatch[] = [];
  for (const p of pairs) {
    if (usedMine.has(p.mine.id) || usedTheirs.has(p.theirs.id)) continue;
    usedMine.add(p.mine.id);
    usedTheirs.add(p.theirs.id);
    matches.push(p);
  }

  const score = 1 - matches.reduce((acc, m) => acc * (1 - m.weight), 1);
  if (score < MIN_LINK_SCORE) return null;

  const extra = matches.length - 1;
  return {
    candidateId: candidate.id,
    score,
    matches,
    why: explainMatch(matches[0]),
    whyMore: extra === 0 ? '' : extra === 1 ? t('why.more_one') : t('why.more_many', { n: extra }),
  };
}

/** Calcule et trie tous les liens (du plus fort au plus faible). */
export function computeLinks(myAnchors: Anchor[], candidates: Candidate[], rarity?: RarityTable): LinkResult[] {
  return candidates
    .map((c) => scoreLink(myAnchors, c, rarity))
    .filter((l): l is LinkResult => l !== null)
    .sort((a, b) => b.score - a.score);
}

/** Transforme une coïncidence en une phrase lisible (« le pourquoi »). */
export function explainMatch(m: AnchorMatch): string {
  const rawSubject = m.mine.subjectLabel ?? '';
  // Métiers et activités ne sont pas des noms propres : minuscule en milieu de phrase.
  const subject =
    m.mine.kind === 'ancestor_job' || m.mine.kind === 'club'
      ? rawSubject.charAt(0).toLowerCase() + rawSubject.slice(1)
      : rawSubject;
  const city = m.mine.cityLabel ?? m.theirs.cityLabel ?? '';
  const params = {
    subject,
    city,
    from: m.overlap?.from ?? '',
    to: m.overlap?.to ?? '',
    gap: m.gapYears === undefined ? '' : m.gapYears === 1 ? t('why.gap_one') : t('why.gap_many', { n: m.gapYears }),
  };
  const timed = (prefix: 'city' | 'school' | 'work' | 'club'): TKey => {
    if (m.precision === 'same_time') return `why.${prefix}_same_time`;
    if (m.precision === 'close') return `why.${prefix}_close`;
    return prefix === 'club' ? (m.sameCity ? 'why.club_same_city' : 'why.club_any') : `why.${prefix}_any`;
  };

  switch (m.mine.kind) {
    case 'city':
    case 'school':
    case 'work':
      return t(timed(m.mine.kind), params);
    case 'club':
      return t(m.sameCity ? timed('club') : 'why.club_any', params);
    case 'ancestor_job':
      return t(m.sameCity ? 'why.ancestor_same_city' : 'why.ancestor_any', {
        ...params,
        myRel: t(`relations.${m.mine.relation ?? 'grandparent'}`),
        theirRel: t(`relationsTheir.${m.theirs.relation ?? 'grandparent'}`),
      });
    case 'event':
      return t(m.sameCity ? 'why.event_same_city' : 'why.event_any', params);
  }
}

/** Score 0..1 → pourcentage arrondi pour l'affichage. */
export const scoreToPercent = (score: number) => Math.round(score * 100);
