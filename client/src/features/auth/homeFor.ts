import type { User } from '@/lib/types';

/** Where each role lands after signing in. */
export function homeFor(user: Pick<User, 'role'>) {
  if (user.role === 'ADMIN') return '/admin';
  if (user.role === 'SUPPORT') return '/desk';
  return '/';
}
