import { dateRangeSchema } from '@busify/shared';
import { parse } from './http';

/**
 * Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD as whole days in the server's local
 * time zone (the computer running BUSIFY). Defaults to the last `defaultDays`.
 */
export function parseDateRange(query: unknown, defaultDays = 30) {
  const q = parse(dateRangeSchema, query);
  const today = new Date();
  const to = q.to ? new Date(`${q.to}T23:59:59.999`) : endOfDay(today);
  const from = q.from ? new Date(`${q.from}T00:00:00`) : startOfDay(addDays(to, -(defaultDays - 1)));
  const days = Math.round((startOfDay(to).getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > 366) {
    // Keep reports fast and charts readable.
    return { from: startOfDay(addDays(to, -365)), to, days: 366 };
  }
  return { from, to, days };
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Local calendar date key, e.g. "2026-10-28". */
export function dayKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) keys.push(dayKey(d));
  return keys;
}
