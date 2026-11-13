import { z } from 'zod';
import { leadFieldsSchema, type LeadFields } from '@/features/leads/schemas';
import { CSV_LIMITS, LeadCsvError, type LeadCsv } from './csv';

const column = z
  .number()
  .int()
  .min(0)
  .max(CSV_LIMITS.columns - 1);
export const importMappingSchema = z
  .object({
    customer_name: column,
    email: column.optional(),
    phone: column.optional(),
    alternate_phone: column.optional(),
    property_type: column.optional(),
    location: column.optional(),
    budget: column.optional(),
    expected_start_on: column.optional(),
    inquiry_on: column.optional(),
    follow_up_on: column.optional(),
    description: column.optional(),
    initial_note: column.optional(),
    priority: column.optional(),
  })
  .strict()
  .refine(
    (value) => {
      const indices = Object.values(value).filter((index) => index !== undefined);
      return new Set(indices).size === indices.length;
    },
    { message: 'Map each CSV column to at most one lead field.' },
  );

const inquiryDate = leadFieldsSchema.shape.inquiry_on.refine(
  (value) => !value.startsWith('0000'),
  'Use a calendar year from 0001 onwards.',
);
export const importPreviewInputSchema = z
  .object({
    mapping: importMappingSchema,
    sourceCode: leadFieldsSchema.shape.source_code,
    assignedUserId: z.uuid().nullable(),
    defaultInquiryOn: inquiryDate,
  })
  .strict();

export type ImportMapping = z.infer<typeof importMappingSchema>;
export type ImportPreviewInput = z.infer<typeof importPreviewInputSchema>;
export type ImportPreviewRow = {
  rowNumber: number;
  data: LeadFields | null;
  errors: { field: string; message: string }[];
  possibleDuplicateRows: number[];
  status: 'ready' | 'invalid' | 'review';
};
export type ImportPreview = {
  rows: ImportPreviewRow[];
  counts: { total: number; ready: number; invalid: number; review: number };
  ignoredBlankRecords: number;
};

const fields = leadFieldsSchema.superRefine((value, context) => {
  for (const field of ['inquiry_on', 'expected_start_on', 'follow_up_on'] as const) {
    if (value[field]?.startsWith('0000')) {
      context.addIssue({ code: 'custom', path: [field], message: 'Use a year from 0001 onwards.' });
    }
  }
});

// Call with parseLeadCsv output, never client-supplied parsed JSON.
// Preview is advisory. Server authorization, source/owner eligibility and database
// duplicate checks must run again before any future import write.
export function previewLeadImport(csv: LeadCsv, input: unknown): ImportPreview {
  const parsed = importPreviewInputSchema.safeParse(input);
  if (!parsed.success) throw new LeadCsvError('Check the column mapping and batch defaults.');
  const { mapping, sourceCode, assignedUserId, defaultInquiryOn } = parsed.data;
  if (Object.values(mapping).some((index) => index !== undefined && index >= csv.headers.length)) {
    throw new LeadCsvError('The mapping references a missing CSV column.');
  }
  const rows: ImportPreviewRow[] = csv.rows.map(({ rowNumber, cells }) => {
    const base: ImportPreviewRow = {
      rowNumber,
      data: null,
      errors: [],
      possibleDuplicateRows: [],
      status: 'invalid',
    };
    if (cells.length !== csv.headers.length) {
      return {
        ...base,
        errors: [{ field: 'row', message: 'Column count differs from the header.' }],
      };
    }
    const value: Record<string, unknown> = {
      customer_name: '',
      email: null,
      phone: null,
      alternate_phone: null,
      source_code: sourceCode,
      assigned_user_id: assignedUserId,
      priority: 'normal',
      property_type: null,
      location: null,
      budget: null,
      expected_start_on: null,
      inquiry_on: defaultInquiryOn,
      follow_up_on: null,
      description: null,
      initial_note: null,
    };
    for (const [field, index] of Object.entries(mapping)) {
      if (index === undefined) continue;
      const text = cells[index].trim();
      value[field] =
        field === 'phone' || field === 'alternate_phone'
          ? text.replace(/[\s().-]/g, '') || null
          : field === 'priority'
            ? text.toLowerCase() || 'normal'
            : text || null;
    }
    const checked = fields.safeParse(value);
    if (!checked.success) {
      return {
        ...base,
        errors: checked.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }
    return { ...base, status: 'ready', data: checked.data };
  });
  const matches = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.data) continue;
    const keys = new Set([
      ...(row.data.email ? [`email:${row.data.email}`] : []),
      ...[row.data.phone, row.data.alternate_phone].flatMap((phone) =>
        phone ? [`phone:${phone}`] : [],
      ),
    ]);
    for (const key of keys) matches.set(key, [...(matches.get(key) ?? []), row.rowNumber]);
  }
  const peers = new Map<number, Set<number>>();
  for (const group of matches.values()) {
    if (group.length < 2) continue;
    for (const rowNumber of group) {
      const others = peers.get(rowNumber) ?? new Set<number>();
      for (const other of group) if (other !== rowNumber) others.add(other);
      peers.set(rowNumber, others);
    }
  }
  const counts = { total: rows.length, ready: 0, invalid: 0, review: 0 };
  for (const row of rows) {
    row.possibleDuplicateRows = [...(peers.get(row.rowNumber) ?? [])].sort((a, b) => a - b);
    if (row.data && row.possibleDuplicateRows.length) row.status = 'review';
    counts[row.status] += 1;
  }
  return { rows, counts, ignoredBlankRecords: csv.ignoredBlankRecords };
}
