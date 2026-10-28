import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export interface NewNotification {
  type: string;
  title: string;
  body: string;
  link?: string;
}

export async function notifyUsers(userIds: number[], n: NewNotification, db: Db = prisma) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await db.notification.createMany({
    data: unique.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null })),
  });
}

/** Notifies every active administrator (used for escalations). */
export async function notifyAdmins(n: NewNotification, db: Db = prisma) {
  const admins = await db.user.findMany({
    where: { status: 'ACTIVE', role: { name: 'ADMIN' } },
    select: { id: true },
  });
  await notifyUsers(
    admins.map((a) => a.id),
    n,
    db,
  );
}
