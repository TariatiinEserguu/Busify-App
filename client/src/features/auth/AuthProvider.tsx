import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, PermissionKey, RegisterInput } from '@busify/shared';
import { api, ApiError, onAuthError } from '@/lib/api';
import type { SessionPayload, User } from '@/lib/types';

interface AuthValue {
  user: User | null;
  permissions: PermissionKey[];
  status: 'loading' | 'authenticated' | 'anonymous' | 'unreachable';
  error: unknown;
  login: (input: LoginInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  setSession: (payload: SessionPayload) => void;
  can: (permission: PermissionKey) => boolean;
  retry: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const ME_KEY = ['auth', 'me'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.get<SessionPayload>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: (count, err) => err instanceof ApiError && err.status === 0 && count < 2,
  });

  const setSession = useCallback(
    (payload: SessionPayload | null) => {
      queryClient.setQueryData(ME_KEY, payload);
    },
    [queryClient],
  );

  /** Drops cached data of the previous user, keeping the session and public config queries alive. */
  const clearUserData = useCallback(
    () => queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' && q.queryKey[0] !== 'config' }),
    [queryClient],
  );

  useEffect(
    () =>
      onAuthError((err) => {
        if (err.status === 401) {
          clearUserData();
          setSession(null);
        } else if (err.code === 'PASSWORD_CHANGE_REQUIRED') {
          void queryClient.invalidateQueries({ queryKey: ME_KEY });
        }
      }),
    [queryClient, setSession, clearUserData],
  );

  const value = useMemo<AuthValue>(() => {
    const data = me.data ?? null;
    let status: AuthValue['status'] = 'loading';
    if (me.isError) status = 'unreachable';
    else if (me.isSuccess) status = data ? 'authenticated' : 'anonymous';
    return {
      user: data?.user ?? null,
      permissions: data?.permissions ?? [],
      status,
      error: me.error,
      async login(input) {
        const payload = await api.post<SessionPayload>('/auth/login', input);
        clearUserData();
        setSession(payload);
        return payload.user;
      },
      async register(input) {
        const payload = await api.post<SessionPayload>('/auth/register', input);
        clearUserData();
        setSession(payload);
        return payload.user;
      },
      async logout() {
        await api.post('/auth/logout').catch(() => undefined);
        clearUserData();
        setSession(null);
      },
      setSession,
      can: (permission) => !!data?.permissions.includes(permission),
      retry: () => void me.refetch(),
    };
  }, [me.data, me.isError, me.isSuccess, me.error, me.refetch, clearUserData, setSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
