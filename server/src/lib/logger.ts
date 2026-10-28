/** Small leveled console logger with readable, timestamped output. */
type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS: Record<Level, string> = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function threshold(): number {
  const level = (process.env.LOG_LEVEL ?? 'info') as Level;
  if (process.env.NODE_ENV === 'test' && !process.env.LOG_LEVEL_TEST) return ORDER.error + 1;
  return ORDER[level] ?? ORDER.info;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function write(level: Level, message: string, meta?: unknown) {
  if (ORDER[level] < threshold()) return;
  const label = level.toUpperCase().padEnd(5);
  const tag = useColor ? `${COLORS[level]}${label}${RESET}` : label;
  let extra = '';
  if (meta instanceof Error) extra = `\n${meta.stack ?? meta.message}`;
  else if (meta !== undefined) extra = ` ${JSON.stringify(meta)}`;
  const line = `${timestamp()} ${tag} ${message}${extra}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
