/**
 * Tiny i18n layer: Mongolian (default) and English.
 *
 * English text is the translation key, so every string in the code stays
 * readable and anything missing from the Mongolian dictionary simply falls
 * back to English. `{name}` placeholders are filled from `vars`.
 *
 * `t()` reads the current language at call time, so it also works outside
 * React (toasts, GPS messages). Components use `useI18n()` so they re-render
 * when the language changes.
 */
import { useSyncExternalStore } from 'react';
import { formatDistance as formatDistanceEn } from '@busify/shared';
import { mn } from './i18n/mn';

export type Lang = 'mn' | 'en';
export const LANGS: Array<{ code: Lang; short: string; label: string }> = [
  { code: 'mn', short: 'МН', label: 'Монгол' },
  { code: 'en', short: 'EN', label: 'English' },
];

const STORAGE_KEY = 'busify.lang';
const listeners = new Set<() => void>();

function readStored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'mn' || v === 'en') return v;
  } catch {
    // Private mode or blocked storage: use the default.
  }
  return 'mn';
}

let current: Lang = readStored();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // The choice just will not survive a reload.
  }
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type Vars = Record<string, string | number | null | undefined>;

function fill(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (vars[key] == null ? match : String(vars[key])));
}

/** Translates an English string (the key) into the current language. */
export function t(key: string, vars?: Vars): string {
  if (!key) return key;
  const template = current === 'mn' ? (mn[key] ?? key) : key;
  return fill(template, vars);
}

/**
 * Count-aware text. English picks `one` or `other`; Mongolian does not inflect
 * nouns after numbers, so it always uses the translation of `other`.
 */
export function tn(count: number, one: string, other: string, vars?: Vars): string {
  const key = current === 'en' && count === 1 ? one : other;
  return t(key, { n: count, ...vars });
}

/** "350 m" / "1.4 km" with localized units ("м", "км"). */
export function formatDistance(meters: number | null | undefined): string {
  const text = formatDistanceEn(meters);
  if (current !== 'mn') return text;
  return text.replace(/ km$/, ' км').replace(/ m$/, ' м');
}

/** Metres with the localized unit, e.g. "200 м". */
export function meters(value: number | string): string {
  return `${value} ${current === 'mn' ? 'м' : 'm'}`;
}

/** BCP 47 locale for Intl formatters. */
export function locale(): string {
  return current === 'mn' ? 'mn-MN' : 'en-GB';
}

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, setLang, t, tn, formatDistance, meters };
}
