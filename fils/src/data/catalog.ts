/**
 * Catalogues de suggestions pour l'autocomplétion de l'onboarding.
 * Les libellés sont des données (pas de l'interface) : à terme ils viendront
 * d'une table de référence côté serveur, par pays.
 */
import { slugify } from '@/core/normalize';

export interface CatalogItem {
  key: string;
  label: string;
  /** Pour les écoles / lieux de travail : ville associée. */
  cityKey?: string;
  /** Pour les événements : années. */
  year?: number;
}

const make = (labels: string[]): CatalogItem[] => labels.map((label) => ({ key: slugify(label), label }));

export const CITIES: CatalogItem[] = make([
  'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Montpellier', 'Strasbourg', 'Bordeaux',
  'Lille', 'Rennes', 'Reims', 'Toulon', 'Saint-Étienne', 'Le Havre', 'Grenoble', 'Dijon', 'Angers',
  'Nîmes', 'Villeurbanne', 'Clermont-Ferrand', 'Le Mans', 'Aix-en-Provence', 'Brest', 'Tours', 'Amiens',
  'Limoges', 'Annecy', 'Perpignan', 'Metz', 'Besançon', 'Orléans', 'Rouen', 'Mulhouse', 'Caen', 'Nancy',
  'Avignon', 'La Rochelle', 'Poitiers', 'Pau', 'Bayonne', 'Lorient', 'Quimper', 'Valence', 'Chambéry',
  'Ajaccio', 'Bastia', 'Calais', 'Dunkerque', 'Lens', 'Roubaix', 'Tourcoing', 'Saint-Malo', 'Vannes', 'Troyes',
  'Bruxelles', 'Liège', 'Genève', 'Lausanne', 'Montréal', 'Québec', 'Dakar', 'Casablanca', 'Alger', 'Tunis',
]);

/** Écoles / lieux de travail connus, rattachés à une ville (suggestions, pas une liste fermée). */
export const SCHOOLS: CatalogItem[] = [
  ['Lycée Ampère', 'Lyon'], ['Lycée du Parc', 'Lyon'], ['Université Lyon 2', 'Lyon'], ['INSA Lyon', 'Villeurbanne'],
  ['Lycée Henri-IV', 'Paris'], ['Lycée Voltaire', 'Paris'], ['Sorbonne Université', 'Paris'], ['Lycée Thiers', 'Marseille'],
  ['Aix-Marseille Université', 'Marseille'], ['Lycée Faidherbe', 'Lille'], ['Université de Lille', 'Lille'],
  ['Lycée Montaigne', 'Bordeaux'], ['Université de Bordeaux', 'Bordeaux'], ['Lycée Clemenceau', 'Nantes'],
  ['Université de Nantes', 'Nantes'], ['Lycée Pierre-de-Fermat', 'Toulouse'], ['Université Toulouse Capitole', 'Toulouse'],
  ['Lycée Kléber', 'Strasbourg'], ['Université de Strasbourg', 'Strasbourg'], ['Lycée Chateaubriand', 'Rennes'],
  ['Université Rennes 2', 'Rennes'], ['Lycée Champollion', 'Grenoble'], ['Lycée Masséna', 'Nice'],
  ['Lycée Joffre', 'Montpellier'], ['École Jules-Ferry', 'Le Havre'], ['Collège Jean-Moulin', 'Brest'],
].map(([label, city]) => ({ key: `${slugify(city)}/${slugify(label)}`, label, cityKey: slugify(city) }));

export const WORKPLACES: CatalogItem[] = [
  ['Hôpital Édouard-Herriot', 'Lyon'], ['Usine Renault Billancourt', 'Paris'], ['Port autonome', 'Marseille'],
  ['Chantiers de l’Atlantique', 'Nantes'], ['Airbus Blagnac', 'Toulouse'], ['Michelin Cataroux', 'Clermont-Ferrand'],
  ['CHU de Bordeaux', 'Bordeaux'], ['Filature La Redoute', 'Roubaix'], ['Arsenal de Brest', 'Brest'],
  ['Mines de Lens', 'Lens'], ['SNCF gare Part-Dieu', 'Lyon'], ['La Poste centre de tri', 'Lille'],
].map(([label, city]) => ({ key: `${slugify(city)}/${slugify(label)}`, label, cityKey: slugify(city) }));

/** Métiers (formulés de façon neutre : « boulangerie » plutôt que « boulanger·ère »). */
export const JOBS: CatalogItem[] = make([
  'Boulangerie', 'Mine (mineur·e)', 'Agriculture', 'Pêche', 'Instituteur·rice', 'Couture', 'Cheminot·e',
  'Facteur·rice', 'Docker', 'Infirmier·ère', 'Menuiserie', 'Forge', 'Viticulture', 'Commerce', 'Imprimerie',
  'Gendarmerie', 'Marine marchande', 'Usine textile', 'Sidérurgie', 'Médecine', 'Boucherie', 'Charpente',
  'Maçonnerie', 'Horlogerie', 'Cordonnerie', 'Sage-femme', 'Douane', 'Tissage', 'Verrerie', 'Coiffure',
]);

export const ACTIVITIES: CatalogItem[] = make([
  'Football', 'Rugby', 'Handball', 'Basket', 'Aviron', 'Natation', 'Judo', 'Danse classique', 'Théâtre',
  'Chorale', 'Fanfare', 'Scouts', 'Échecs', 'Escalade', 'Voile', 'Tennis', 'Athlétisme', 'Cyclisme',
  'Club photo', 'Conservatoire', 'Patronage', 'Colonie de vacances', 'Radio associative', 'Club de lecture',
]);

/** Événements marquants (avec année, pour l'affichage). */
export const EVENTS: CatalogItem[] = [
  ['Coupe du monde 1998', 1998], ['Tempête de décembre 1999', 1999], ['Passage à l’an 2000', 2000],
  ['Passage à l’euro', 2002], ['Canicule 2003', 2003], ['Éclipse solaire de 1999', 1999],
  ['Mai 68', 1968], ['Premier pas sur la Lune', 1969], ['Chute du mur de Berlin', 1989],
  ['Grand hiver 1985', 1985], ['Crue de la Seine 2016', 2016], ['Confinement 2020', 2020],
  ['Incendie de Notre-Dame', 2019], ['JO de Paris 2024', 2024], ['Grève de 1995', 1995], ['Tempête Xynthia', 2010],
].map(([label, year]) => ({ key: slugify(String(label)), label: String(label), year: Number(year) }));

export function search(items: CatalogItem[], query: string, limit = 6): CatalogItem[] {
  const q = slugify(query);
  if (!q) return items.slice(0, limit);
  const starts = items.filter((i) => i.key.split('/').pop()!.startsWith(q) || slugify(i.label).startsWith(q));
  const contains = items.filter((i) => !starts.includes(i) && slugify(i.label).includes(q));
  return [...starts, ...contains].slice(0, limit);
}

export function cityLabel(cityKey?: string): string | undefined {
  if (!cityKey) return undefined;
  return CITIES.find((c) => c.key === cityKey)?.label ?? cityKey;
}
