import { api } from './api';

const THROTTLE_MS = 30 * 60_000;
const memory = new Map<string, number>();

/** Last time this message was reported from this browser tab (survives page reloads). */
function lastSent(message: string): number | undefined {
  try {
    const value = sessionStorage.getItem(`busify.reported.${message}`);
    return value ? Number(value) : memory.get(message);
  } catch {
    return memory.get(message);
  }
}

function markSent(message: string, at: number) {
  memory.set(message, at);
  try {
    sessionStorage.setItem(`busify.reported.${message}`, String(at));
  } catch {
    // Storage unavailable (private mode): the in-memory throttle still applies.
  }
}

/**
 * Sends a client-side problem to the server's error log (visible in Admin →
 * Activity). The same message is reported at most once every 30 minutes per
 * tab, so an offline map does not flood the log on every page.
 */
export function reportClientError(message: string, context?: Record<string, unknown>, stack?: string) {
  const now = Date.now();
  const last = lastSent(message);
  if (last && now - last < THROTTLE_MS) return;
  markSent(message, now);
  void api
    .post('/client-errors', { message: message.slice(0, 1000), stack: stack?.slice(0, 5000), path: location.pathname, context })
    .catch(() => undefined);
}

export function installGlobalErrorReporting() {
  window.addEventListener('error', (event) => {
    reportClientError(event.message || 'Script error', { source: event.filename, line: event.lineno }, event.error?.stack);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string; stack?: string; name?: string } | undefined;
    if (reason?.name === 'ApiError' || reason?.name === 'AbortError') return;
    reportClientError(reason?.message ?? 'Unhandled promise rejection', undefined, reason?.stack);
  });
}
