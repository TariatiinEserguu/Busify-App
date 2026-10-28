import { ERROR_CODES, toFieldIssues, type FieldIssue } from '@busify/shared';
import type { z } from 'zod';

/** An error that maps directly to an HTTP response. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { issues?: FieldIssue[]; [key: string]: unknown },
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, issues?: FieldIssue[]) =>
  new HttpError(400, ERROR_CODES.VALIDATION, message, issues ? { issues } : undefined);
export const unauthorized = (message = 'Please sign in to continue.') =>
  new HttpError(401, ERROR_CODES.UNAUTHENTICATED, message);
export const forbidden = (message = 'You do not have permission to do that.', code: string = ERROR_CODES.FORBIDDEN) =>
  new HttpError(403, code, message);
export const notFound = (what = 'Resource') => new HttpError(404, ERROR_CODES.NOT_FOUND, `${what} not found.`);
export const conflict = (message: string, code: string = ERROR_CODES.CONFLICT, details?: Record<string, unknown>) =>
  new HttpError(409, code, message, details);

/** Validates input with a zod schema, throwing a 400 with per-field issues. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = toFieldIssues(result.error);
    throw badRequest(issues[0]?.message ?? 'Invalid request', issues);
  }
  return result.data;
}

/** Parses a positive integer route parameter such as :id. */
export function idParam(value: unknown, what = 'Resource'): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw notFound(what);
  return id;
}
