import { SectionNavigation } from '@/components/shell/section-navigation';
import { Eyebrow, Heading, Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import type { WorkspaceModule } from '@/types/workspace';

export function SecondaryNavigation({
  module,
  pathname,
  expanded,
}: {
  module: WorkspaceModule;
  pathname: string;
  expanded: boolean;
}) {
  return (
    <aside
      id="secondary-navigation"
      data-testid="secondary-navigation"
      aria-label="Contextual navigation"
      aria-hidden={!expanded}
      inert={!expanded}
      className={cn(
        'hidden shrink-0 overflow-hidden border-border bg-card transition-[width] duration-200 ease-calm motion-reduce:transition-none lg:block',
        expanded ? 'w-64 border-r' : 'w-0 border-r-0',
      )}
    >
      <div className="sticky top-3 flex min-h-[calc(100svh-1.5rem)] w-64 flex-col p-5">
        <div className="space-y-3 pb-6">
          <Eyebrow>Workspace</Eyebrow>
          <Heading as="h2" size="md">
            {module.title}
          </Heading>
          <Text tone="muted" className="text-sm">
            {module.description}
          </Text>
        </div>

        <SectionNavigation module={module} pathname={pathname} />

        <div className="mt-auto pt-8">
          <div className="rounded-card border border-border bg-muted p-4">
            <p className="text-sm font-semibold">A foundation in progress</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Navigation is available. Business records and permissions are introduced in later
              phases.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
