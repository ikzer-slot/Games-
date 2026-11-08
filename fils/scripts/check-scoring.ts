/**
 * Vérifications de l'algorithme de score (sans framework de test) :
 *   npm run test:scoring
 */
import { computeLinks, scoreLink } from '../src/core/scoring';
import type { Anchor, Candidate } from '../src/core/types';
import { DEMO_PROFILES } from '../src/data/demoProfiles';

let failures = 0;
function expect(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✔' : '✘'} ${label}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
}

const A = (p: Partial<Anchor> & Pick<Anchor, 'kind'>, id = Math.random().toString(36)): Anchor => ({ id, visible: true, ...p });
const lyon = (from?: number, to?: number) => A({ kind: 'city', cityKey: 'lyon', cityLabel: 'Lyon', startYear: from, endYear: to });
const cand = (id: string, anchors: Anchor[]): Candidate => ({ id, anchors });
const me = [lyon(2008, 2012)];

const sameTime = scoreLink(me, cand('a', [lyon(2010, 2014)]))!;
const close = scoreLink(me, cand('b', [lyon(2015, 2016)]))!;
const far = scoreLink(me, cand('c', [lyon(1980, 1985)]))!;
const undated = scoreLink(me, cand('d', [lyon()]))!;
expect('même ville + même époque > même ville à 3 ans d’écart', sameTime.score > close.score, `${sameTime.score.toFixed(3)} > ${close.score.toFixed(3)}`);
expect('3 ans d’écart > même ville seulement (non daté)', close.score > undated.score, `${close.score.toFixed(3)} > ${undated.score.toFixed(3)}`);
expect('non daté > époques très éloignées', undated.score > far.score, `${undated.score.toFixed(3)} > ${far.score.toFixed(3)}`);
expect('phrase « même époque »', sameTime.why.includes('en même temps (2010–2012)'), sameTime.why);
expect('phrase « écart »', close.why.includes('3 ans d’écart'), close.why);

const school = (from: number) =>
  A({ kind: 'school', cityKey: 'lyon', cityLabel: 'Lyon', subjectKey: 'lyon/lycee-ampere', subjectLabel: 'Lycée Ampère', startYear: from, endYear: from + 3 });
const s1 = scoreLink([school(2001)], cand('e', [school(2007)]))!;
expect('école à 3 ans d’écart > ville à la même époque', s1.score > sameTime.score, `${s1.score.toFixed(3)} > ${sameTime.score.toFixed(3)}`);
expect('phrase école', s1.why.includes('Lycée Ampère') && s1.why.includes('3 ans d’écart'), s1.why);

const gp = (city: string | undefined, rel: Anchor['relation']) =>
  A({ kind: 'ancestor_job', subjectKey: 'boulangerie', subjectLabel: 'Boulangerie', cityKey: city, cityLabel: city && 'Lille', relation: rel });
const g1 = scoreLink([gp('lille', 'grandfather')], cand('f', [gp('lille', 'grandmother')]))!;
const g2 = scoreLink([gp('lille', 'grandfather')], cand('g', [gp('brest', 'grandmother')]))!;
expect('grands-parents même métier même ville > villes différentes', g1.score > g2.score);
expect('phrase grands-parents', g1.why.includes('Votre grand-père et la grand-mère'), g1.why);

const ev = (city?: string) => A({ kind: 'event', subjectKey: 'canicule-2003', subjectLabel: 'Canicule 2003', cityKey: city, cityLabel: city && 'Paris' });
const e1 = scoreLink([ev('paris')], cand('h', [ev('paris')]))!;
expect('un événement national pèse moins qu’une école', e1.score < s1.score);

const multi = scoreLink([lyon(2008, 2012), ev('paris')], cand('i', [lyon(2010, 2011), ev('paris')]))!;
expect('deux points communs > un seul', multi.score > sameTime.score && multi.score < 1);
expect('« et un autre point commun »', multi.whyMore === 'Et un autre point commun.', multi.whyMore);

const hidden = scoreLink([{ ...lyon(2008, 2012), visible: false }], cand('j', [lyon(2010, 2014)]));
expect('un ancrage masqué ne crée aucun lien', hidden === null);

// Démo : un profil type doit trouver des liens dans les 50 profils.
const sample: Anchor[] = [
  lyon(2008, 2012),
  A({ kind: 'school', cityKey: 'lyon', cityLabel: 'Lyon', subjectKey: 'lyon/lycee-ampere', subjectLabel: 'Lycée Ampère', startYear: 2002, endYear: 2005 }),
  A({ kind: 'event', subjectKey: 'canicule-2003', subjectLabel: 'Canicule 2003', cityKey: 'paris', cityLabel: 'Paris' }),
];
const links = computeLinks(sample, DEMO_PROFILES.map((p) => ({ id: p.id, anchors: p.anchors })));
expect('le jeu de démo produit des liens', links.length >= 5, `${links.length} liens, meilleur : ${links[0]?.why}`);

console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
