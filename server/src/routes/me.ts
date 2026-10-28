import { Router } from 'express';
import { profileSchema, userSettingsSchema } from '@busify/shared';
import { audit } from '../lib/audit';
import { badRequest, parse } from '../lib/http';
import { prisma } from '../lib/prisma';
import { getSettings } from '../lib/settings';
import { publicUserSelect, toPublicUser } from '../lib/users';
import { requireAuth } from '../middleware/auth';

export const meRouter = Router();
meRouter.use(requireAuth);

const settingsSelect = {
  alertRadiusM: true,
  soundEnabled: true,
  vibrationEnabled: true,
  notificationsEnabled: true,
  keepScreenAwake: true,
  updatedAt: true,
} as const;

async function loadSettings(userId: number) {
  const existing = await prisma.userSettings.findUnique({ where: { userId }, select: settingsSelect });
  if (existing) return existing;
  const system = await getSettings();
  return prisma.userSettings.create({
    data: { userId, alertRadiusM: system.defaultAlertRadiusM },
    select: settingsSelect,
  });
}

/** GET /api/me/settings — the passenger's alert preferences. */
meRouter.get('/settings', async (req, res) => {
  res.json({ settings: await loadSettings(req.auth!.user.id) });
});

/** PUT /api/me/settings */
meRouter.put('/settings', async (req, res) => {
  const input = parse(userSettingsSchema, req.body);
  const system = await getSettings();
  if (input.alertRadiusM < system.minAlertRadiusM || input.alertRadiusM > system.maxAlertRadiusM) {
    throw badRequest(`Alert distance must be between ${system.minAlertRadiusM} and ${system.maxAlertRadiusM} m.`, [
      { path: 'alertRadiusM', message: `Choose ${system.minAlertRadiusM}–${system.maxAlertRadiusM} m` },
    ]);
  }
  const userId = req.auth!.user.id;
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
    select: settingsSelect,
  });
  res.json({ settings });
});

/** PATCH /api/me/profile — name and phone number. */
meRouter.patch('/profile', async (req, res) => {
  const input = parse(profileSchema, req.body);
  const user = await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { name: input.name, phone: input.phone ? input.phone : null },
    select: publicUserSelect,
  });
  await audit(req, { action: 'user.profile_update', entityType: 'user', entityId: user.id, summary: 'Profile updated' });
  res.json({ user: toPublicUser(user) });
});
