/**
 * Required reference data: roles, permissions and default system settings.
 * Safe to run any number of times. Contains no sample routes or accounts.
 */
import type { PrismaClient } from '@prisma/client';
import { PERMISSION_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES, type PermissionKey } from '@busify/shared';
import { SETTING_DEFAULTS } from './settings';

const ROLE_DESCRIPTIONS: Record<(typeof ROLES)[number], string> = {
  PASSENGER: 'Plans journeys, receives bus stop alerts and contacts support.',
  SUPPORT: 'Handles passenger feedback and complaints and escalates issues. No administrative access.',
  ADMIN: 'Manages routes, stops, users, settings and reports.',
};

export async function seedBaseData(prisma: PrismaClient) {
  const keys = Object.keys(PERMISSION_DESCRIPTIONS) as PermissionKey[];
  for (const key of keys) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: PERMISSION_DESCRIPTIONS[key] },
      update: { description: PERMISSION_DESCRIPTIONS[key] },
    });
  }
  const permissions = await prisma.permission.findMany();
  const permissionId = new Map(permissions.map((p) => [p.key, p.id]));

  for (const name of ROLES) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name, label: ROLE_LABELS[name], description: ROLE_DESCRIPTIONS[name] },
      update: { label: ROLE_LABELS[name], description: ROLE_DESCRIPTIONS[name] },
    });
    // Make the stored permissions match the definition exactly.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: ROLE_PERMISSIONS[name].map((key) => ({ roleId: role.id, permissionId: permissionId.get(key)! })),
    });
  }

  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    // Only fill in missing settings; never overwrite what an administrator chose.
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: {},
    });
  }

  return { roles: ROLES.length, permissions: keys.length };
}
