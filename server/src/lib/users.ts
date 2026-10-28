import type { Prisma } from '@prisma/client';
import type { PermissionKey, RoleName } from '@busify/shared';

/**
 * The only user fields that ever leave the server. passwordHash is
 * deliberately absent so it cannot be serialised by accident.
 */
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  status: true,
  mustChangePassword: true,
  isDemoAccount: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { name: true, label: true } },
} satisfies Prisma.UserSelect;

export type PublicUserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: RoleName;
  roleLabel: string;
  status: 'ACTIVE' | 'SUSPENDED';
  mustChangePassword: boolean;
  isDemoAccount: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export function toPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role.name as RoleName,
    roleLabel: row.role.label,
    status: row.status,
    mustChangePassword: row.mustChangePassword,
    isDemoAccount: row.isDemoAccount,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

export interface AuthContext {
  sessionId: string;
  user: PublicUser;
  permissions: Set<PermissionKey>;
}
