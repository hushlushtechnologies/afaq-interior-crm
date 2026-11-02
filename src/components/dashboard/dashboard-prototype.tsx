'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3, Folder, Users, Wallet } from 'lucide-react';

import { MiniBarChart, MiniLineChart } from '@/components/charts/mini-charts';
import { MetricCard } from '@/components/dashboard/metric-card';
import { DemoBanner } from '@/components/demo/demo-banner';
import { useDemoCrm } from '@/components/demo/demo-crm-provider';
import { DemoStatePanel } from '@/components/demo/demo-state-panel';
import { PageHeader } from '@/components/layout/page-header';
import { WorkspaceDetails } from '@/components/shell/workspace-details';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import {
  buildDemoLeadTrend,
  formatDemoDate,
  formatDemoMoney,
  isWithinDemoPeriod,
} from '@/lib/demo/format';
import { DEMO_STAGES, isProtectedDemoStage } from '@/lib/demo/stages';
import { cn, focusRing } from '@/lib/utils';
import type { DemoPeriod, DemoQuotation } from '@/types/demo-crm';

const quotationStatuses: readonly {
  id: DemoQuotation['status'];
  label: string;
}[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'pm-review', label: 'PM review' },
  { id: 'approved', label: 'Approved' },
  { id: 'sent', label: 'Sent' },
  { id: 'accepted', label: 'Accepted' },
];

export function DashboardPrototype() {
  const { data, previewState, setPreviewState } = useDemoCrm();
  const [period, setPeriod] = useState<DemoPeriod>('30');

  const visibleLeads = useMemo(
    () => data.leads.filter((lead) => isWithinDemoPeriod(lead.createdOn, period, data.asOfDate)),
    [data.leads, data.asOfDate, period],
  );

  const visibleQuotations = data.quotations.filter((quotation) =>
    isWithinDemoPeriod(quotation.createdOn, period, data.asOfDate),
  );

  const visibleApprovals = data.approvals.filter((approval) =>
    isWithinDemoPeriod(approval.requestedOn, period, data.asOfDate),
  );

  const openBudget = visibleLeads
    .filter((lead) => !isProtectedDemoStage(lead.stage))
    .reduce((total, lead) => total + lead.budget, 0);

  const pendingQuotations = visibleQuotations.filter(
    (quotation) => quotation.status === 'pm-review',
  );

  const pipeline = DEMO_STAGES.map((stage) => ({
    label: stage.label,
    value: visibleLeads.filter((lead) => lead.stage === stage.id).length,
  }));

  const sources = ['Meta Lead Ads', 'Website', 'Phone', 'Referral', 'Manual'].map((source) => ({
    label: source,
    value: visibleLeads.filter((lead) => lead.source === source).length,
  }));

  const quotationSummary = quotationStatuses.map((status) => ({
    label: status.label,
    value: visibleQuotations.filter((quotation) => quotation.status === status.id).length,
  }));

  const followUps = visibleLeads
    .filter((lead) => lead.nextFollowUpOn !== null && !isProtectedDemoStage(lead.stage))
    .sort((left, right) => (left.nextFollowUpOn ?? '').localeCompare(right.nextFollowUpOn ?? ''))
    .slice(0, 4);

  const recentActivity = data.leads
    .flatMap((lead) =>
      lead.activities.map((activity) => ({
        ...activity,
        clientName: lead.clientName,
      })),
    )
    .filter((activity) => isWithinDemoPeriod(activity.at, period, data.asOfDate))
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, 5);

  const trend = buildDemoLeadTrend(visibleLeads, period, data.asOfDate);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Dashboard"
        eyebrow="Afaq Al Manzel"
        description="A calm overview of sample sales activity, project focus and upcoming work."
        actions={<WorkspaceDetails moduleId="dashboard" />}
      />

      <DemoBanner />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
          The date filter applies to inquiry, quotation, approval and activity samples. Project
          status shows all sample projects.
        </p>

        <div className="space-y-2">
          <Label htmlFor="dashboard-period">Dashboard date range</Label>

          <select
            id="dashboard-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as DemoPeriod)}
            className={cn(
              'min-h-12 rounded-control border border-input bg-card px-3 text-sm',
              focusRing,
            )}
          >
            <option value="7">Last 7 demo days</option>
            <option value="30">Last 30 demo days</option>
            <option value="all">All demo history</option>
          </select>
        </div>
      </div>

      {previewState !== 'ready' ? (
        <DemoStatePanel state={previewState} onRetry={() => setPreviewState('ready')} />
      ) : (
        <>
          <section aria-label="Sales snapshot">
            <h2 className="sr-only">Sales snapshot</h2>

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <MetricCard
                label="Inquiries"
                value={String(visibleLeads.length)}
                description="Sample inquiries in the selected period."
                icon={Users}
                testId="dashboard-lead-count"
              />

              <MetricCard
                label="Open sample budgets"
                value={formatDemoMoney(openBudget)}
                description="Illustrative budgets, not contract revenue."
                icon={Wallet}
              />

              <MetricCard
                label="Awaiting quote review"
                value={String(pendingQuotations.length)}
                description="Sample quotation versions awaiting PM review."
                icon={Clock3}
              />

              <MetricCard
                label="Sample projects"
                value={String(data.projects.length)}
                description="All fictional projects in this preview."
                icon={Folder}
              />
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sales pipeline</CardTitle>
                <CardDescription>
                  Sample inquiries grouped by their current demo stage.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <MiniBarChart label="Sample inquiry counts by sales stage" data={pipeline} />
              </CardContent>
            </Card>

            <div className="grid gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Inquiry trend</CardTitle>
                  <CardDescription>
                    Counts reconcile with inquiries in the selected demo period.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <MiniLineChart label="Sample inquiry trend" data={trend} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lead sources</CardTitle>
                  <CardDescription>Source attribution for the filtered sample.</CardDescription>
                </CardHeader>

                <CardContent>
                  <MiniBarChart label="Sample inquiry counts by source" data={sources} />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming follow-ups</CardTitle>
                <CardDescription>Dates are compared with the fixed demo snapshot.</CardDescription>
              </CardHeader>

              <CardContent>
                {followUps.length > 0 ? (
                  <ul className="space-y-4">
                    {followUps.map((lead) => {
                      const overdue =
                        lead.nextFollowUpOn !== null && lead.nextFollowUpOn < data.asOfDate;

                      return (
                        <li key={lead.id} className="flex items-start gap-3">
                          <Avatar name={lead.clientName} size="sm" />

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{lead.clientName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{lead.title}</p>
                          </div>

                          <Badge tone={overdue ? 'warning' : 'outline'}>
                            {lead.nextFollowUpOn
                              ? formatDemoDate(lead.nextFollowUpOn, false)
                              : 'Unscheduled'}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No follow-ups in this demo period.
                  </p>
                )}

                <Link
                  href="/leads/follow-ups"
                  className={cn(
                    'mt-5 inline-flex min-h-11 items-center gap-2 rounded-control text-sm font-semibold',
                    focusRing,
                  )}
                >
                  Open follow-up workspace
                  <Icon icon={ArrowUpRight} size="sm" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quotation summary</CardTitle>
                <CardDescription>
                  Sample statuses only. No approval or sending action is performed.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <MiniBarChart label="Sample quotations grouped by status" data={quotationSummary} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Project focus</CardTitle>
                <CardDescription>
                  Illustrative progress across all three sample projects.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="space-y-6">
                  {data.projects.map((project) => (
                    <li key={project.id} className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{project.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Focus: {project.focus}
                          </p>
                        </div>

                        <span className="text-sm font-semibold tabular-nums">
                          {project.progress}%
                        </span>
                      </div>

                      <progress
                        value={project.progress}
                        max={100}
                        aria-label={project.name + ' sample progress'}
                        className="h-2 w-full overflow-hidden rounded-full accent-primary [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
                      />

                      <p className="text-xs text-muted-foreground">
                        Sample target: {formatDemoDate(project.targetDate)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="grid gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Pending approvals</CardTitle>
                  <CardDescription>
                    Sample requests linked to existing preview pages.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {visibleApprovals.length > 0 ? (
                    <ul className="space-y-2">
                      {visibleApprovals.map((approval) => (
                        <li key={approval.id}>
                          <Link
                            href={approval.href}
                            className={cn(
                              'flex min-h-14 items-center justify-between gap-3 rounded-control px-3 py-2 hover:bg-muted',
                              focusRing,
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{approval.title}</span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {approval.kind}
                              </span>
                            </span>

                            <Icon icon={ArrowUpRight} size="sm" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No sample approvals in this period.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent activity</CardTitle>
                  <CardDescription>
                    Fictional activity from the selected demo period.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {recentActivity.length > 0 ? (
                    <ul className="space-y-4">
                      {recentActivity.map((activity) => (
                        <li key={activity.id} className="border-l-2 border-secondary pl-4">
                          <p className="text-sm font-semibold">{activity.clientName}</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {activity.summary}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatDemoDate(activity.at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No activity in this demo period.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
