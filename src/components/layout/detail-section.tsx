import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DetailSectionProps = {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DetailSection({
  id,
  title,
  description,
  actions,
  children,
  className,
}: DetailSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'min-w-0 rounded-card border border-border bg-card p-5 shadow-card sm:p-6',
        className,
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>

          {description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {actions}
      </div>

      {children}
    </section>
  );
}
