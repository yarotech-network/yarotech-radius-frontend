import type { ReactNode } from 'react';
import { cn } from '@/lib/utilities/cn';

/** A settings section: titled card with an optional icon, header actions and footer bar. */
export function SettingsCard({
  id,
  title,
  description,
  icon,
  actions,
  children,
  footer,
  className,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** Small controls on the right of the header, e.g. a refresh button. */
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        'scroll-mt-24 overflow-hidden rounded-card border border-border bg-surface',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 [&>svg]:size-4.5"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 id={headingId} className="text-base font-semibold text-ink-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 max-w-2xl text-sm text-ink-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-muted px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
          {footer}
        </div>
      )}
    </section>
  );
}
