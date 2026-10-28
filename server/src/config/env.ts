/**
 * Loads and validates configuration from the project's `.env` file.
 * Every value has a safe default except DATABASE_URL; problems are reported
 * with a clear message instead of a stack trace.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/** Folder that contains prisma/schema.prisma (works from src/ and from dist/). */
function findServerRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'prisma', 'schema.prisma'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export const SERVER_ROOT = findServerRoot();
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

// BUSIFY_ENV_FILE overrides the location (tests set it to "none" to load no file).
const envFileCandidates =
  process.env.BUSIFY_ENV_FILE !== undefined
    ? [process.env.BUSIFY_ENV_FILE]
    : [path.join(PROJECT_ROOT, '.env'), path.join(SERVER_ROOT, '.env')];

export const loadedEnvFile = envFileCandidates.find((p) => existsSync(p)) ?? null;
if (loadedEnvFile) {
  // Values already present in the real environment win over the file.
  dotenv.config({ path: loadedEnvFile, quiet: true });
}

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v.trim() === '') return fallback;
      const s = v.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(s)) return true;
      if (['false', '0', 'no', 'off'].includes(s)) return false;
      ctx.addIssue({ code: 'custom', message: `expected true or false, got "${v}"` });
      return z.NEVER;
    });

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LAN_ONLY: bool(true),
  DATABASE_URL: z
    .string({
      error: 'DATABASE_URL is missing. Copy .env.example to .env (or run `npm run setup`).',
    })
    .trim()
    .min(1, 'DATABASE_URL is empty. Use e.g. DATABASE_URL="file:../data/busify.db".')
    .refine((v) => v.startsWith('file:'), 'DATABASE_URL must be a SQLite URL starting with "file:"'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(168),
  COOKIE_SECURE: z.enum(['auto', 'true', 'false']).default('auto'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).max(10_000).default(30),
  HTTPS_ENABLED: bool(false),
  HTTPS_CERT_FILE: optionalString,
  HTTPS_KEY_FILE: optionalString,
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Missing DEMO_MODE means "off": demo credentials never work by accident.
  DEMO_MODE: bool(false),
  DEMO_ACCOUNT_PASSWORD: optionalString,
  VITE_MAP_TILE_URL: optionalString,
  CLIENT_DIST_DIR: optionalString,
});

export type Env = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`);
    if (!loadedEnvFile) problems.push('No .env file was found. Run `npm run setup` or copy .env.example to .env.');
    throw new ConfigError(problems);
  }
  const env = result.data;
  if (env.HTTPS_ENABLED && !!env.HTTPS_CERT_FILE !== !!env.HTTPS_KEY_FILE) {
    throw new ConfigError(['HTTPS_CERT_FILE and HTTPS_KEY_FILE must be set together (or both left empty).']);
  }
  return env;
}

export const env: Env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const cookieSecure = env.COOKIE_SECURE === 'auto' ? env.HTTPS_ENABLED : env.COOKIE_SECURE === 'true';

/** Absolute path of the SQLite file (relative URLs are resolved from server/prisma like Prisma does). */
export function sqliteFilePath(url = env.DATABASE_URL): string {
  const raw = url.replace(/^file:/, '').split('?')[0];
  return path.isAbsolute(raw) ? raw : path.resolve(SERVER_ROOT, 'prisma', raw);
}
