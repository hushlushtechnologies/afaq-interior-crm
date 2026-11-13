import { expect, test } from '@playwright/test';
import { CSV_LIMITS, LeadCsvError, parseLeadCsv } from '../../src/features/lead-import/csv';
import {
  importMappingSchema,
  previewLeadImport,
  type ImportPreviewInput,
} from '../../src/features/lead-import/preview';

const bytes = (text: string) => new TextEncoder().encode(text);
const csv = (text: string) => parseLeadCsv('leads.csv', bytes(text));
const defaults: ImportPreviewInput = {
  mapping: { customer_name: 0 },
  sourceCode: 'manual',
  assignedUserId: null,
  defaultInquiryOn: '2026-11-12',
};
const preview = (text: string, mapping = defaults.mapping) =>
  previewLeadImport(csv(text), { ...defaults, mapping });

test('UTF-8 BOM, Unicode, commas, escaped quotes and multiline fields retain evidence', () => {
  const parsed = csv('\uFEFFName,Note\r\nأحمد,"Room, with ""glass""\r\nand wood"\r\n');
  expect(parsed.headers).toEqual(['Name', 'Note']);
  expect(parsed.rows).toEqual([
    { rowNumber: 2, cells: ['أحمد', 'Room, with "glass"\r\nand wood'] },
  ]);
});

test('logical record numbers survive blank records and quoted newlines', () => {
  const parsed = csv('Name,Note\n\nAlex,"One\ntwo"\n\nSam,Three');
  expect(parsed.rows.map((row) => row.rowNumber)).toEqual([3, 5]);
  expect(parsed.ignoredBlankRecords).toBe(2);
});

test('CSV quoting is strict and malformed files fail without echoing their content', () => {
  for (const text of ['Name\n"Secret', 'Name\nSe"cret', 'Name\n"Secret"oops']) {
    expect(() => csv(text)).toThrow(LeadCsvError);
    try {
      csv(text);
    } catch (error) {
      expect((error as Error).message).not.toContain('Secret');
    }
  }
});

test('invalid UTF-8, binary controls, empty input and unsupported filenames are rejected', () => {
  for (const filename of ['leads.xlsx', '../leads.csv', 'folder\\leads.csv', 'leads.csv.exe']) {
    expect(() => parseLeadCsv(filename, bytes('Name\nAlex'))).toThrow(LeadCsvError);
  }
  expect(() => parseLeadCsv('leads.csv', new Uint8Array([0xc3, 0x28]))).toThrow(/UTF-8/);
  expect(() => csv('Name\nAlex\u0000')).toThrow(/control/);
  expect(() => csv('')).toThrow(/nonempty/);
  expect(() => csv('Name\n')).toThrow(/at least one/);
});

test('headers must be nonempty and unique after trimming and case normalization', () => {
  for (const text of ['Name, name\nAlex,Sam', 'Name,\nAlex,Sam']) {
    expect(() => csv(text)).toThrow(/unique/);
  }
  expect(() => csv(`${'H'.repeat(161)}\nAlex`)).toThrow(/160/);
});

test('byte, row, column and field resource limits fail before producing a preview', () => {
  expect(() => parseLeadCsv('leads.csv', new Uint8Array(CSV_LIMITS.bytes + 1))).toThrow(/1 MiB/);
  expect(() => csv(`Name\n${'Alex\n'.repeat(501)}`)).toThrow(/500/);
  expect(() => csv(`${Array.from({ length: 41 }, (_, i) => `H${i}`).join(',')}\nAlex`)).toThrow(
    /40/,
  );
  expect(() => csv(`Name\n${'A'.repeat(4001)}`)).toThrow(/4000/);
  expect(csv(`Name\n${'Alex\n'.repeat(500)}`).rows).toHaveLength(500);
});

test('mapping requires customer name and rejects repeated columns and protected fields', () => {
  expect(importMappingSchema.safeParse({ email: 0 }).success).toBe(false);
  expect(importMappingSchema.safeParse({ customer_name: 0, email: 0 }).success).toBe(false);
  for (const field of ['stage', 'created_by', 'source_code', 'assigned_user_id', 'external_id']) {
    expect(importMappingSchema.safeParse({ customer_name: 0, [field]: 1 }).success).toBe(false);
  }
  expect(() => preview('Name\nAlex', { customer_name: 1 })).toThrow(/missing CSV column/);
});

test('missing optional information stays null and defaults are explicit', () => {
  const result = preview('Name\nAlex');
  expect(result.rows[0].data).toMatchObject({
    customer_name: 'Alex',
    phone: null,
    email: null,
    budget: null,
    source_code: 'manual',
    assigned_user_id: null,
    priority: 'normal',
    inquiry_on: '2026-11-12',
  });
  expect(result.counts).toEqual({ total: 1, ready: 1, invalid: 0, review: 0 });
  expect(preview('Name\nAlex', { customer_name: 0, email: undefined }).counts.ready).toBe(1);
});

test('email and international phone normalization preserve exact decimal budgets', () => {
  const result = preview(
    'Name,Email,Phone,Budget\nAlex, ALEX@example.test ,+971 (50) 123-4567,00125.50',
    {
      customer_name: 0,
      email: 1,
      phone: 2,
      budget: 3,
    },
  );
  expect(result.rows[0].data).toMatchObject({
    email: 'alex@example.test',
    phone: '+971501234567',
    budget: '00125.50',
  });
});

test('invalid names, phones, dates and budgets remain row errors without invented corrections', () => {
  for (const [field, value] of [
    ['customer_name', 'A'],
    ['phone', '0501234567'],
    ['email', 'not-an-email'],
    ['budget', 'AED 1,000'],
    ['inquiry_on', '2026-02-30'],
    ['expected_start_on', '0000-01-01'],
    ['priority', 'critical'],
  ] as const) {
    const result = preview(`Name,Value\nAlex,"${value}"`, {
      customer_name: field === 'customer_name' ? 1 : 0,
      ...(field === 'customer_name' ? {} : { [field]: 1 }),
    });
    expect(result.rows[0].status).toBe('invalid');
    expect(result.rows[0].data).toBeNull();
    expect(result.rows[0].errors.some((error) => error.field === field)).toBe(true);
  }
});

test('explicitly mapped empty inquiry dates are invalid instead of silently replaced', () => {
  const result = preview('Name,Date\nAlex,', { customer_name: 0, inquiry_on: 1 });
  expect(result.rows[0].status).toBe('invalid');
  expect(() =>
    previewLeadImport(csv('Name\nAlex'), { ...defaults, defaultInquiryOn: '0000-01-01' }),
  ).toThrow(LeadCsvError);
});

test('email and cross-phone matches flag every valid candidate without merging or dropping', () => {
  const result = preview(
    'Name,Email,Phone,Alternate\nAlex,A@example.test,+971501234567,\nSam,a@example.test,,\nJo,,,+971 50 123 4567',
    { customer_name: 0, email: 1, phone: 2, alternate_phone: 3 },
  );
  expect(result.counts).toEqual({ total: 3, ready: 0, invalid: 0, review: 3 });
  expect(result.rows.map((row) => row.possibleDuplicateRows)).toEqual([[3, 4], [2], [2]]);
  expect(result.rows.every((row) => row.data !== null)).toBe(true);
});

test('matching names alone do not identify duplicate customers', () => {
  const result = preview('Name\nAlex\nAlex');
  expect(result.counts.ready).toBe(2);
  expect(result.rows.every((row) => row.possibleDuplicateRows.length === 0)).toBe(true);
});

test('width errors and field errors reconcile with ready and review counts', () => {
  const result = preview(
    'Name,Email\nAlex,a@example.test\nSam,A@example.test\nX,\nJo\nLee,l@example.test',
    {
      customer_name: 0,
      email: 1,
    },
  );
  expect(result.counts).toEqual({ total: 5, ready: 1, invalid: 2, review: 2 });
  expect(result.rows[3].errors[0].field).toBe('row');
});

test('special header names are indexed, and formula-like text remains literal data', () => {
  const result = preview('__proto__,Note\nAlex,=SUM(1+1)', { customer_name: 0, initial_note: 1 });
  expect(result.rows[0].data?.initial_note).toBe('=SUM(1+1)');
  expect(result.rows[0].data?.customer_name).toBe('Alex');
});
