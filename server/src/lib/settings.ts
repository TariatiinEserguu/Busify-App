/**
 * System-wide settings an administrator can change at runtime
 * (stored as JSON values in the SystemSetting table).
 */
import {
  DEFAULT_ALERT_RADIUS_M,
  DEFAULT_CONFIRM_READINGS,
  DEFAULT_MAX_ACCURACY_M,
  MAX_ALERT_RADIUS_M,
  MIN_ALERT_RADIUS_M,
  type SystemSettingsInput,
} from '@busify/shared';
import { prisma } from './prisma';

export type SystemSettings = SystemSettingsInput;

export const SETTING_DEFAULTS: SystemSettings = {
  defaultAlertRadiusM: DEFAULT_ALERT_RADIUS_M,
  minAlertRadiusM: MIN_ALERT_RADIUS_M,
  maxAlertRadiusM: MAX_ALERT_RADIUS_M,
  gpsMaxAccuracyM: DEFAULT_MAX_ACCURACY_M,
  alertConfirmReadings: DEFAULT_CONFIRM_READINGS,
  registrationOpen: true,
  announcement: '',
};

let cache: { value: SystemSettings; at: number } | null = null;
const CACHE_MS = 10_000;

export async function getSettings(): Promise<SystemSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const rows = await prisma.systemSetting.findMany();
  const merged: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    if (!(row.key in SETTING_DEFAULTS)) continue;
    try {
      const value = JSON.parse(row.value);
      if (typeof value === typeof SETTING_DEFAULTS[row.key as keyof SystemSettings]) merged[row.key] = value;
    } catch {
      // Ignore a corrupt value and keep the default.
    }
  }
  cache = { value: merged as SystemSettings, at: Date.now() };
  return cache.value;
}

export async function saveSettings(values: SystemSettings, actorId: number | null) {
  await prisma.$transaction(
    (Object.keys(SETTING_DEFAULTS) as Array<keyof SystemSettings>).map((key) =>
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(values[key]), updatedById: actorId },
        update: { value: JSON.stringify(values[key]), updatedById: actorId },
      }),
    ),
  );
  cache = null;
  return getSettings();
}

export function clearSettingsCache() {
  cache = null;
}
