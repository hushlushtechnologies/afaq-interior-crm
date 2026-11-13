import { z } from 'zod';

const date = z.iso.date().refine((value) => !value.startsWith('0000-'));
export const reportRangeSchema = z
  .object({ from: date, to: date })
  .strict()
  .refine(({ from, to }) => {
    const days = (Date.parse(to) - Date.parse(from)) / 86400000;
    return days >= 0 && days <= 365;
  }, 'Choose an ordered range of at most 366 calendar days.');
export type ReportRange = z.infer<typeof reportRangeSchema>;
export type ReportMode = 'dashboard' | 'report';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const group = z.object({ key: z.string(), label: z.string(), value: count });
export const leadReportSchema = z.object({
  from: date,
  to: date,
  asOf: z.iso.datetime({ offset: true }),
  leads: z.object({ total: count, new: count, archived: count }),
  stages: z.array(group),
  sources: z.array(group),
  owners: z.array(group),
  trend: z.array(group),
  lossReasons: z.array(group),
  followUps: z.object({
    total: count,
    completed: count,
    cancelled: count,
    open: count,
    overdue: count,
    upcoming: count,
    needsReview: count,
  }),
});
export type LeadReport = z.infer<typeof leadReportSchema>;

export function defaultReportRange(now: Date): ReportRange {
  const to = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const from = new Date(`${to}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: from.toISOString().slice(0, 10), to };
}