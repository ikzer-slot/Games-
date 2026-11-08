import { t } from '@/i18n';
import type { Anchor } from './types';

export function periodText(a: Anchor): string {
  if (a.startYear == null && a.endYear == null) return '';
  if (a.startYear != null && a.endYear != null && a.startYear !== a.endYear) return `${a.startYear}–${a.endYear}`;
  return String(a.startYear ?? a.endYear);
}

/** Titre court d'un ancrage, ex. « Lycée Ampère » ou « Lyon ». */
export function anchorTitle(a: Anchor): string {
  if (a.kind === 'city') return a.cityLabel ?? '';
  if (a.kind === 'ancestor_job') return `${capitalize(t(`relations.${a.relation ?? 'grandparent'}`))} · ${a.subjectLabel ?? ''}`;
  return a.subjectLabel ?? '';
}

/** Sous-titre, ex. « Lyon · 2005–2008 ». */
export function anchorSubtitle(a: Anchor): string {
  const parts = [a.kind === 'city' ? undefined : a.cityLabel, periodText(a)].filter(Boolean);
  return parts.join(' · ');
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
