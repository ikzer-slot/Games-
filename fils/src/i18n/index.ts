import fr, { type Dictionary } from './fr';

/** Union typée de toutes les clés "section.cle" du dictionnaire. */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dictionary>;
export type TParams = Record<string, string | number>;

const dictionaries: Record<string, Dictionary> = { fr };
let current: Dictionary = fr;

export function setLocale(locale: string) {
  current = dictionaries[locale] ?? fr;
}

export function t(key: TKey, params?: TParams): string {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], current);
  const template = typeof value === 'string' ? value : key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? String(params[name]) : `{${name}}`));
}
