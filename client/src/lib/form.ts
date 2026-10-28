import { useCallback, useState, type ChangeEvent } from 'react';
import { toFieldIssues } from '@busify/shared';
import type { z } from 'zod';
import { ApiError } from './api';

/**
 * Minimal form state: values, per-field errors, validation with the shared
 * zod schemas (same rules as the server) and mapping of server field errors.
 */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!(key as string in e)) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  const bind = <K extends keyof T>(key: K) => ({
    name: key as string,
    value: (values[key] ?? '') as string,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value as T[K]),
  });

  function validate<S extends z.ZodType>(schema: S, input: unknown = values): z.output<S> | null {
    const result = schema.safeParse(input);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of toFieldIssues(result.error)) if (!(issue.path in next)) next[issue.path || '_form'] = issue.message;
      setErrors(next);
      return null;
    }
    setErrors({});
    return result.data;
  }

  /** Shows server-side field errors next to inputs; returns true if any were mapped. */
  const applyServerError = (err: unknown) => {
    if (err instanceof ApiError && err.issues.length > 0) {
      setErrors(err.fieldErrors());
      return true;
    }
    return false;
  };

  return { values, setValues, set, bind, errors, setErrors, validate, applyServerError };
}
