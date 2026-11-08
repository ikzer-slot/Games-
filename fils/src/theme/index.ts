import type { AnchorKind } from '@/core/types';

/** Palette sombre et chaude : nuit d'encre, fils cuivrés, nœuds lumineux. */
export const colors = {
  bg: '#0E0D12',
  bgDeep: '#08070B',
  surface: '#17151C',
  surfaceAlt: '#211E28',
  border: '#2E2A36',
  text: '#F3EDE4',
  textMuted: '#A59D95',
  textFaint: '#6E6871',
  accent: '#F4B860',
  accentDim: '#8A6A3E',
  thread: '#C9A27A',
  success: '#8FD1B0',
  danger: '#E07A6A',
  me: '#FFE7BF',
};

export const kindColors: Record<AnchorKind, string> = {
  city: '#F4B860',
  school: '#8EC5FF',
  work: '#B9A3FF',
  ancestor_job: '#EBA3C4',
  club: '#8FD1B0',
  event: '#F7D774',
};

export const kindEmoji: Record<AnchorKind, string> = {
  city: '🏙️',
  school: '🎓',
  work: '🧰',
  ancestor_job: '🧓',
  club: '🎻',
  event: '✨',
};

export const spacing = (n: number) => n * 4;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };

export const font = {
  // Police système : sobre et lisible. Une serif douce pour les titres.
  title: { fontSize: 30, fontWeight: '600' as const, letterSpacing: 0.2, color: colors.text },
  h2: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, lineHeight: 23, color: colors.text },
  small: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  serif: { fontFamily: 'Georgia' },
};
