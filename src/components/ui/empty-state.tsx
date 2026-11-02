import { FolderOpen, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon = FolderOpen,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-control border border-dashed border-border bg-background p-6 text-center',
        className,
      )}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon icon={icon} />
      </div>

      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>

      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
