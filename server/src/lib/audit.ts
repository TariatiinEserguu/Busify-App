import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { logger } from './logger';
import { prisma } from './prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  /** Defaults to the signed-in user. */
  actorId?: number | null;
}

/** Records an entry in the audit trail. Never throws: auditing must not break the action itself. */
export async function audit(req: Request | null, entry: AuditEntry, db: Db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId !== undefined ? entry.actorId : (req?.auth?.user.id ?? null),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId != null ? String(entry.entityId) : null,
        summary: entry.summary.slice(0, 500),
        metadata: entry.metadata,
        ipAddress: req?.ip ?? null,
      },
    });
  } catch (err) {
    logger.warn(`Could not write audit log for ${entry.action}`, err);
  }
}
