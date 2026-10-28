/**
 * Everything that makes the alert noticeable: sound, vibration, a system
 * notification, a flashing tab title, and keeping the screen awake during a
 * journey. Every feature degrades gracefully when the browser lacks it.
 */

let audioContext: AudioContext | null = null;

/** Browsers only allow sound after a user gesture; call this from a click (e.g. "Start journey"). */
export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function chime(ctx: AudioContext, at: number) {
  // Two-tone "ding-dong", loud enough to wake a dozing passenger.
  const tones: Array<[number, number]> = [
    [880, 0],
    [660, 0.28],
    [880, 0.56],
  ];
  for (const [freq, offset] of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at + offset);
    gain.gain.exponentialRampToValueAtTime(0.6, at + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + offset + 0.26);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at + offset);
    osc.stop(at + offset + 0.3);
  }
}

export const capabilities = {
  sound: () => typeof window !== 'undefined' && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext),
  vibration: () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
  notifications: () => typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext,
  wakeLock: () => typeof navigator !== 'undefined' && 'wakeLock' in navigator && window.isSecureContext,
};

/** Repeats sound and vibration until stopped (at most `maxMs`). Returns a stop function. */
export function startAlarm(options: { sound: boolean; vibration: boolean; maxMs?: number }): () => void {
  const timers: number[] = [];
  const stopAt = Date.now() + (options.maxMs ?? 30_000);

  if (options.sound) {
    unlockAudio();
    const ctx = audioContext;
    if (ctx) {
      const ring = () => {
        if (Date.now() > stopAt) return;
        chime(ctx, ctx.currentTime + 0.02);
      };
      ring();
      timers.push(window.setInterval(ring, 1800));
    }
  }
  if (options.vibration && capabilities.vibration()) {
    const buzz = () => {
      if (Date.now() > stopAt) return;
      navigator.vibrate([500, 200, 500, 200, 800]);
    };
    buzz();
    timers.push(window.setInterval(buzz, 2600));
  }
  return () => {
    timers.forEach((t) => window.clearInterval(t));
    if (capabilities.vibration()) navigator.vibrate(0);
  };
}

/** A short single chime + buzz for the "Test alert" button. */
export function testAlert(options: { sound: boolean; vibration: boolean }) {
  const stop = startAlarm({ ...options, maxMs: 2500 });
  window.setTimeout(stop, 2500);
}

let serviceWorker: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerNotificationWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return Promise.resolve(null);
  serviceWorker ??= navigator.serviceWorker.register('/sw.js').catch(() => null);
  return serviceWorker;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!capabilities.notifications()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export async function showSystemNotification(title: string, body: string) {
  if (!capabilities.notifications() || Notification.permission !== 'granted') return false;
  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body,
    tag: 'busify-stop-alert',
    requireInteraction: true,
    icon: '/favicon.svg',
    vibrate: [500, 200, 500],
  };
  try {
    const reg = await registerNotificationWorker();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/** Alternates the tab title so the alert is visible from another tab. */
export function flashTitle(message: string): () => void {
  const original = document.title;
  let on = false;
  const timer = window.setInterval(() => {
    document.title = (on = !on) ? message : original;
  }, 1000);
  return () => {
    window.clearInterval(timer);
    document.title = original;
  };
}

/** Keeps the screen on while a journey is tracked (re-acquired when the tab becomes visible again). */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;
  private readonly onVisibility = () => {
    if (this.wanted && document.visibilityState === 'visible') void this.acquire();
  };

  get active() {
    return !!this.sentinel && !this.sentinel.released;
  }

  async enable() {
    this.wanted = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    return this.acquire();
  }

  private async acquire() {
    if (!capabilities.wakeLock() || this.active) return this.active;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      return true;
    } catch {
      return false;
    }
  }

  release() {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.sentinel?.release().catch(() => undefined);
    this.sentinel = null;
  }
}
