import type { DemoChartPoint, DemoLead, DemoPeriod } from '@/types/demo-crm';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDemoMoney(value: number): string {
  return (
    'AED ' +
    new Intl.NumberFormat('en-GB', {
      maximumFractionDigits: 0,
    }).format(value)
  );
}

export function getDemoDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return year && month && day ? year + '-' + month + '-' + day : '';
}

export function formatDemoDate(value: string, includeYear = true): string {
  const key = getDemoDateKey(value);

  if (!key) {
    return '—';
  }

  const [year, month, day] = key.split('-');
  const monthName = MONTHS[Number(month) - 1];

  if (!monthName) {
    return '—';
  }

  return day + ' ' + monthName + (includeYear ? ' ' + year : '');
}

function dayNumber(date: string): number {
  return Math.floor(Date.parse(date + 'T00:00:00Z') / 86_400_000);
}

function dayKey(value: number): string {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

export function isWithinDemoPeriod(value: string, period: DemoPeriod, asOfDate: string): boolean {
  const date = getDemoDateKey(value);

  if (!date || date > asOfDate) {
    return false;
  }

  if (period === 'all') {
    return true;
  }

  const start = dayKey(dayNumber(asOfDate) - Number(period) + 1);

  return date >= start;
}

export function buildDemoLeadTrend(
  leads: readonly DemoLead[],
  period: DemoPeriod,
  asOfDate: string,
): DemoChartPoint[] {
  const end = dayNumber(asOfDate);

  const start =
    period === 'all'
      ? leads.reduce((earliest, lead) => Math.min(earliest, dayNumber(lead.createdOn)), end)
      : end - Number(period) + 1;

  const totalDays = Math.max(1, end - start + 1);
  const bucketCount = Math.min(6, totalDays);

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = start + Math.floor((index * totalDays) / bucketCount);

    const bucketEnd = start + Math.floor(((index + 1) * totalDays) / bucketCount) - 1;

    return {
      label: formatDemoDate(dayKey(bucketStart), false),
      value: leads.filter((lead) => {
        const created = dayNumber(lead.createdOn);
        return created >= bucketStart && created <= bucketEnd;
      }).length,
    };
  });
}
