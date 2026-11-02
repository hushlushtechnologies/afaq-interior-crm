import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';

export function MetricCard({
  label,
  value,
  description,
  icon,
  testId,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  testId?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>

        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-muted">
          <Icon icon={icon} size="sm" />
        </span>
      </CardHeader>

      <CardContent>
        <p
          data-testid={testId}
          className="text-xl leading-tight font-semibold tracking-tight tabular-nums sm:text-2xl xl:text-3xl"
        >
          {value}
        </p>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
