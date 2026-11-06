import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  className?: string;
  /** A single input/select/textarea; it receives id and aria attributes. */
  children: ReactElement<Record<string, unknown>>;
  optional?: boolean;
}

/** Label + control + hint/error, wired up for screen readers. */
export function Field({ label, error, hint, className, children, optional }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: (children.props.id as string | undefined) ?? id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={(children.props.id as string | undefined) ?? id} className={cn('block text-sm font-semibold', error ? 'text-bad' : 'text-ink')}>
        {label}
        {optional && <span className="ml-1 font-normal text-ink-subtle">({t('optional')})</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-bad animate-fade-in" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}
