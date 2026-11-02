import { CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export type NoticeTone = 'info' | 'success' | 'warning' | 'destructive';

type InlineNoticeProps = Omit<ComponentProps<'div'>, 'title'> & {
  title: string;
  tone?: NoticeTone;
};

const NOTICE_STYLES = {
  info: 'border-info/30 bg-info-soft text-info',
  success: 'border-success/30 bg-success-soft text-success',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  destructive: 'border-destructive/30 bg-destructive-soft text-destructive',
} satisfies Record<NoticeTone, string>;

const NOTICE_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: CircleAlert,
};

export function InlineNotice({
  title,
  tone = 'info',
  children,
  className,
  ...props
}: InlineNoticeProps) {
  return (
    <div
      {...props}
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-control border p-4',
        NOTICE_STYLES[tone],
        className,
      )}
    >
      <Icon icon={NOTICE_ICONS[tone]} className="mt-0.5 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold">{title}</p>

        {children ? (
          <div className="mt-1 break-words text-sm leading-6 text-foreground">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
