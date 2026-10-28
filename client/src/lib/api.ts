import type { FieldIssue } from '@busify/shared';
import { appConfig } from './config';

/** An error response from the BUSIFY API (or a network failure, status 0). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: FieldIssue[] = [],
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field → message map for showing errors next to form inputs. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of this.issues) if (!(issue.path in out)) out[issue.path] = issue.message;
    return out;
  }
}

type Listener = (error: ApiError) => void;
const authListeners = new Set<Listener>();

/** Notified on 401 / password-change-required so the app can redirect. */
export function onAuthError(listener: Listener) {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-Busify-Client'] = 'web';
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the BUSIFY server. Check that it is running and you are on the same network.');
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; issues?: FieldIssue[] } } | null)?.error;
    const error = new ApiError(
      res.status,
      e?.code ?? 'HTTP_ERROR',
      e?.message ?? `Request failed (${res.status})`,
      e?.issues ?? [],
      (e as Record<string, unknown>) ?? {},
    );
    if (res.status === 401 || error.code === 'PASSWORD_CHANGE_REQUIRED') {
      for (const listener of authListeners) listener(error);
    }
    throw error;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};

/** Builds a query string, skipping empty values. */
export function qs(params: object) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
