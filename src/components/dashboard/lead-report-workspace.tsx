import { Clock3, ListChecks, Sparkles, Users } from 'lucide-react';
import { MiniBarChart, MiniLineChart } from '@/components/charts/mini-charts';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Result } from '@/features/leads/schemas';
import type { LeadReport, ReportMode, ReportRange } from '@/features/lead-reports/contracts';
import { DEMO_STAGES } from '@/lib/demo/stages';

export function LeadReportWorkspace({
  initial,
  range,
  mode,
}: {
  initial: Result<LeadReport>;
  range: ReportRange;
  mode: ReportMode;
}) {
  const data = initial.status === 'ok' ? initial.data : null;
  const groups = data
    ? [
        {
          title: 'Sales pipeline',
          description: 'Current stage of leads created in the range.',
          points: DEMO_STAGES.map((stage) => ({
            label: stage.label,
            value: data.stages.find((item) => item.key === stage.id)?.value ?? 0,
          })),
        },
        {
          title: 'Lead sources',
          description: 'Original source attribution; includes archived leads.',
          points: data.sources,
        },
        {
          title: 'Owner workload',
          description:
            'Current lead ownership in the creation cohort; includes closed and archived leads.',
          points: data.owners.map((owner) => ({
            ...owner,
            label:
              owner.key === 'unassigned'
                ? owner.label
                : `${owner.label} (${owner.key.slice(0, 8)})`,
          })),
        },
        {
          title: 'Current Lost reasons',
          description:
            'Currently Lost leads in the creation cohort. Reopened loss episodes remain in history.',
          points: data.lossReasons,
        },
      ]
    : [];
  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <PageHeader
        title={mode === 'dashboard' ? 'Dashboard' : 'Sales reports'}
        eyebrow="Afaq Al Manzel"
        description="Lead metrics from records your current account can view."
      />
      <form
        action={mode === 'dashboard' ? '/dashboard' : '/reports/sales'}
        method="get"
        aria-label="Report dates"
        className="flex flex-wrap items-end gap-4"
      >
        <div className="space-y-2">
          <Label htmlFor="report-from">From</Label>
          <Input id="report-from" name="from" type="date" required defaultValue={range.from} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-to">To</Label>
          <Input id="report-to" name="to" type="date" required defaultValue={range.to} />
        </div>
        <Button type="submit">Apply dates</Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Dubai calendar dates, inclusive; maximum 366 days. Leads use creation dates. Follow-ups
        independently use scheduled due dates, including tasks for older leads. Archived leads
        remain in historical counts.
      </p>
      {initial.status === 'error' && <p role="alert">{initial.message}</p>}
      {data && (
        <>
          <p className="text-xs text-muted-foreground">
            Snapshot{' '}
            {new Intl.DateTimeFormat('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Dubai',
            }).format(new Date(data.asOf))}{' '}
            (Dubai). Reload or apply dates to refresh.
          </p>
          {data.leads.total === 0 && (
            <p role="status">No visible leads were created in this range.</p>
          )}
          <section aria-label="Sales snapshot" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <MetricCard
              label="Total leads"
              value={String(data.leads.total)}
              description={`${data.leads.archived} archived; all current stages included.`}
              icon={Users}
              testId="report-lead-total"
            />
            <MetricCard
              label="New stage"
              value={String(data.leads.new)}
              description="Creation cohort currently at New."
              icon={Sparkles}
              testId="report-new-total"
            />
            <MetricCard
              label="Overdue follow-ups"
              value={String(data.followUps.overdue)}
              description="Open tasks past due, on active leads with an eligible current owner."
              icon={Clock3}
              testId="report-overdue-total"
            />
            <MetricCard
              label="Upcoming follow-ups"
              value={String(data.followUps.upcoming)}
              description="Open tasks due from now, on active leads with an eligible current owner."
              icon={ListChecks}
              testId="report-upcoming-total"
            />
          </section>
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle>{group.title}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {group.points.length ? (
                    <MiniBarChart label={group.title} data={group.points} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No matching records.</p>
                  )}
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardHeader>
                <CardTitle>Lead creation trend</CardTitle>
                <CardDescription>
                  Monthly counts within the selected range. First and last months may be partial.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MiniLineChart label="Lead creation trend" data={data.trend} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Follow-up completion</CardTitle>
                <CardDescription>
                  Tasks due in this range; current statuses. Scoped employees see their own tasks,
                  managers with company lead visibility see the permitted team.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MiniBarChart
                  label="Follow-up status counts"
                  data={[
                    { label: 'Open', value: data.followUps.open },
                    { label: 'Completed', value: data.followUps.completed },
                    { label: 'Cancelled', value: data.followUps.cancelled },
                  ]}
                />
                <p className="mt-4 text-sm">
                  {data.followUps.total} scheduled tasks. {data.followUps.needsReview} open tasks
                  need owner review. Open tasks on closed or archived leads are excluded from
                  overdue and upcoming counts.
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">
            Counts describe recorded inquiries and tasks. Quotation delivery, project conversion and
            financial results require their approved workflows; no conversion or revenue figures are
            inferred.
          </p>
        </>
      )}
    </div>
  );
}