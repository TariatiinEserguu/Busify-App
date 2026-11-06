import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { locale, t } from './i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatters follow the selected language; they are cached per language.
const cache = new Map<string, Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function dtf(kind: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale()}|${kind}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(locale(), options);
    cache.set(key, f);
  }
  return f;
}
function rtf() {
  const key = `${locale()}|relative`;
  let f = cache.get(key) as Intl.RelativeTimeFormat | undefined;
  if (!f) {
    f = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
    cache.set(key, f);
  }
  return f;
}

export function formatDateTime(value: string | Date | null | undefined) {
  return value ? dtf('datetime', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}
export function formatDate(value: string | Date | null | undefined) {
  return value ? dtf('date', { dateStyle: 'medium' }).format(new Date(value)) : '—';
}
export function formatTime(value: string | Date | null | undefined) {
  return value ? dtf('time', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '—';
}
/** Compact "10/31 08:42" used in dense staff tables. */
export function formatShortDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Short weekday, e.g. "Да" / "Mon". */
export function formatWeekday(value: string | Date) {
  return dtf('weekday', { weekday: 'short' }).format(new Date(value));
}

/** "just now", "3 min ago", "2 h ago", "yesterday"… */
export function timeAgo(value: string | Date | null | undefined, now = Date.now()) {
  if (!value) return '—';
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return t('just now');
  if (abs < 3600) return rtf().format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf().format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf().format(Math.round(seconds / 86_400), 'day');
  return formatDate(value);
}

export function formatDuration(fromIso: string | Date, toIso: string | Date | null | undefined) {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return t('{n} min', { n: minutes });
  const h = Math.floor(minutes / 60);
  return t('{h} h {m} min', { h, m: minutes % 60 });
}

export function formatHours(hours: number | null | undefined) {
  if (hours == null) return '—';
  if (hours < 1) return t('{n} min', { n: Math.round(hours * 60) });
  if (hours < 48) return t('{n} h', { n: hours.toFixed(1) });
  return t('{n} days', { n: (hours / 24).toFixed(1) });
}

/** Local date as YYYY-MM-DD for <input type="date">. */
export function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Downloads rows as a CSV file (opens in Excel). */
export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
