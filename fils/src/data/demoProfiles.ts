/**
 * ~50 faux profils déterministes pour voir le graphe vivre sans vrais
 * utilisateurs. Générés par un PRNG à graine fixe : mêmes profils à chaque
 * lancement, et réutilisés par scripts/generate-seed.ts pour supabase/seed.sql.
 */
import type { AncestorRelation, Anchor, AnchorKind } from '@/core/types';
import { ACTIVITIES, CITIES, EVENTS, JOBS, SCHOOLS, WORKPLACES, cityLabel, type CatalogItem } from './catalog';

export interface DemoProfile {
  id: string;
  pseudo: string;
  /** Probabilité d'accepter un « bonjour » (simulation du mode démo). */
  acceptsHello: boolean;
  anchors: Anchor[];
}

const PSEUDOS = [
  'Camille_l', 'Noé', 'Inès.b', 'Malik', 'Jeanne83', 'Sacha', 'Lou', 'Yanis_r', 'Odile', 'Bastien', 'Aïcha',
  'Gaspard', 'Léna', 'Rémi', 'Margaux_t', 'Nadia', 'Hugo', 'Fatou', 'Simone', 'Théo', 'Clémence', 'Karim',
  'Manon', 'Paulo', 'Rose', 'Antoine', 'Zoé', 'Mehdi', 'Agathe', 'Lucien', 'Salomé', 'Victor', 'Élise',
  'Ousmane', 'Juliette', 'Arthur', 'Mila', 'Raphaël', 'Anaïs', 'Gilles', 'Chloé', 'Thomas', 'Leïla',
  'Martin', 'Céleste', 'Bruno', 'Pauline', 'Ibrahim', 'Sophie', 'Marius',
];

/** Villes sur-représentées pour garantir des coïncidences dans la démo. */
const HOT_CITIES = ['lyon', 'paris', 'lille', 'nantes', 'marseille', 'bordeaux', 'toulouse', 'rennes', 'strasbourg', 'brest'];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoUuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

export function generateDemoProfiles(count = 50, seed = 1998): DemoProfile[] {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const city = (): CatalogItem => {
    const key = rand() < 0.75 ? pick(HOT_CITIES) : pick(CITIES).key;
    return CITIES.find((c) => c.key === key)!;
  };

  const profiles: DemoProfile[] = [];
  for (let i = 0; i < count; i++) {
    const id = demoUuid(i + 1);
    const birth = int(1948, 2003);
    const anchors: Anchor[] = [];
    let n = 0;
    const add = (a: Omit<Anchor, 'id' | 'visible'>) => anchors.push({ ...a, id: `${id}-a${n++}`, visible: true });

    // 1. Toujours une ville + période d'âge adulte.
    const c = city();
    const cityStart = int(birth + 18, Math.min(birth + 40, 2020));
    add({ kind: 'city', cityKey: c.key, cityLabel: c.label, startYear: cityStart, endYear: Math.min(cityStart + int(2, 9), 2025) });

    // 2..5 : tirage parmi les autres types, sans doublon de type.
    const kinds: AnchorKind[] = ['school', 'work', 'ancestor_job', 'club', 'event', 'city'];
    const wanted = int(2, 4);
    const chosen = new Set<AnchorKind>();
    while (chosen.size < wanted) chosen.add(pick(kinds));

    for (const kind of chosen) {
      switch (kind) {
        case 'city': {
          const c2 = city();
          const s = int(birth + 5, Math.min(birth + 30, 2018));
          add({ kind, cityKey: c2.key, cityLabel: c2.label, startYear: s, endYear: s + int(1, 6) });
          break;
        }
        case 'school': {
          const pool = rand() < 0.6 ? SCHOOLS.filter((x) => HOT_CITIES.includes(x.cityKey!)) : SCHOOLS;
          const s = pick(pool);
          const start = birth + int(11, 18);
          add({ kind, cityKey: s.cityKey, cityLabel: cityLabel(s.cityKey), subjectKey: s.key, subjectLabel: s.label, startYear: start, endYear: start + int(2, 4) });
          break;
        }
        case 'work': {
          const w = pick(WORKPLACES);
          const start = int(birth + 20, Math.min(birth + 45, 2022));
          add({ kind, cityKey: w.cityKey, cityLabel: cityLabel(w.cityKey), subjectKey: w.key, subjectLabel: w.label, startYear: start, endYear: Math.min(start + int(1, 12), 2025) });
          break;
        }
        case 'ancestor_job': {
          const j = pick(JOBS.slice(0, 14)); // métiers courants : plus de coïncidences
          const c2 = rand() < 0.8 ? city() : undefined;
          const decade = int(193, 197) * 10;
          add({ kind, relation: pick<AncestorRelation>(['grandfather', 'grandmother', 'grandparent']), subjectKey: j.key, subjectLabel: j.label, cityKey: c2?.key, cityLabel: c2?.label, startYear: decade, endYear: decade + 9 });
          break;
        }
        case 'club': {
          const act = pick(ACTIVITIES.slice(0, 16));
          const c2 = city();
          const start = birth + int(7, 16);
          add({ kind, subjectKey: act.key, subjectLabel: act.label, cityKey: c2.key, cityLabel: c2.label, startYear: start, endYear: start + int(1, 6) });
          break;
        }
        case 'event': {
          const lived = EVENTS.filter((e) => e.year! >= birth + 6);
          if (lived.length === 0) break;
          const ev = pick(lived);
          const c2 = rand() < 0.7 ? city() : undefined;
          add({ kind, subjectKey: ev.key, subjectLabel: ev.label, cityKey: c2?.key, cityLabel: c2?.label, startYear: ev.year, endYear: ev.year });
          break;
        }
      }
    }

    profiles.push({ id, pseudo: PSEUDOS[i % PSEUDOS.length], acceptsHello: rand() < 0.75, anchors });
  }
  return profiles;
}

export const DEMO_PROFILES = generateDemoProfiles();

/** Réponses simulées quand un profil de démo accepte un « bonjour ». */
export const DEMO_REPLIES = [
  'Oh, incroyable ! Oui, je m’en souviens très bien. C’est fou que nos chemins se soient croisés.',
  'Bonjour ! Quelle coïncidence… Vous étiez dans quel quartier ?',
  'Ha ! Le monde est petit. Ça me rappelle plein de souvenirs.',
  'Bonjour 🙂 Je n’aurais jamais imaginé ça. Racontez-moi !',
  'Coucou ! C’est émouvant de lire ça. Mon grand-père en parlait souvent.',
];
