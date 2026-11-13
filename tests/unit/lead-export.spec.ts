import { expect, test } from '@playwright/test';
import {
  LEAD_CSV_LIMITS,
  LeadCsvExportError,
  serializeLeadCsv,
} from '../../src/features/lead-export/csv';
import { parseLeadCsv } from '../../src/features/lead-import/csv';

const encoder = new TextEncoder();
function decode(text: string) {
  return parseLeadCsv('synthetic.csv', encoder.encode(text));
}

test('CSV quotes delimiters, quotes and embedded line breaks without creating extra records', () => {
  const values = ['Customer, name', 'Quoted "name"', 'First\r\nSecond', 'Line\nnext'];
  const csv = serializeLeadCsv(['One', 'Two', 'Three', 'Four'], [values]);
  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv.endsWith('\r\n')).toBe(true);
  expect(decode(csv).rows.map((row) => row.cells)).toEqual([values]);
});

test('formula operators, including international phone prefixes, are text escaped', () => {
  for (const text of ['=1+1', '+971501234567', '-1+2', '@SUM(1,2)']) {
    expect(decode(serializeLeadCsv(['Value'], [[text]])).rows[0].cells).toEqual([`'${text}`]);
  }
});

test('spaces, Unicode formatting characters and compatibility operators cannot conceal formulas', () => {
  for (const text of [
    ' =1+1',
    '\u00a0+1',
    '\u200b@SUM(1)',
    '\ufeff-1',
    '＝1+1',
    '＋1',
    '－1',
    '＠SUM(1)',
  ]) {
    expect(decode(serializeLeadCsv(['Value'], [[text]])).rows[0].cells[0]).toBe(`'${text}`);
  }
});

test('leading tabs and line breaks are escaped even without a formula operator', () => {
  for (const text of ['\tCustomer', '\rCustomer', '\nCustomer', ' \tCustomer', '\r\n=1']) {
    expect(decode(serializeLeadCsv(['Value'], [[text]])).rows[0].cells[0]).toBe(`'${text}`);
  }
});

test('CSV separator injection remains inside its original cell after formula escaping', () => {
  const value = '=HYPERLINK("https://example.invalid","x"),"\r\n=1+1';
  const parsed = decode(serializeLeadCsv(['Value', 'Other'], [[value, 'Unchanged']]));
  expect(parsed.rows).toHaveLength(1);
  expect(parsed.rows[0].cells).toEqual([`'${value}`, 'Unchanged']);
});

test('ordinary Unicode, apostrophes, nulls, zero and decimal strings retain their representation', () => {
  const parsed = decode(
    serializeLeadCsv(
      ['Name', 'Note', 'Missing', 'Count', 'Budget'],
      [['عميل 🏠', "O'Brien", null, 0, '1234.50']],
    ),
  );
  expect(parsed.rows[0].cells).toEqual(['عميل 🏠', "O'Brien", '', '0', '1234.50']);
});

test('unsafe header cells receive the same escaping as data cells', () => {
  const parsed = decode(serializeLeadCsv(['=Header', 'Normal'], [['Value', 'Value']]));
  expect(parsed.headers).toEqual(["'=Header", 'Normal']);
});

test('empty exports return a header-only document', () => {
  expect(serializeLeadCsv(['Reference', 'Customer'], [])).toBe('\uFEFF"Reference","Customer"\r\n');
});

test('invalid column selections and mismatched rows reject the entire document', () => {
  for (const headers of [
    [],
    [''],
    ['  '],
    ['Name', 'Name'],
    Array.from({ length: 33 }, (_, i) => `Column ${i}`),
  ])
    expect(() => serializeLeadCsv(headers, [])).toThrow(LeadCsvExportError);
  expect(() => serializeLeadCsv(['One', 'Two'], [['Only one']])).toThrow(LeadCsvExportError);
});

test('control bytes and malformed Unicode are rejected instead of silently removed', () => {
  for (const text of ['\0Customer', 'Customer\u0007', '\u007f', '\u0085=1', '\ud800'])
    expect(() => serializeLeadCsv(['Value'], [[text]])).toThrow(LeadCsvExportError);
});

test('nonfinite and unsafe numeric ranges cannot silently corrupt exported numbers', () => {
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(() => serializeLeadCsv(['Value'], [[value]])).toThrow(LeadCsvExportError);
  expect(decode(serializeLeadCsv(['Value'], [[Number.MAX_SAFE_INTEGER]])).rows[0].cells[0]).toBe(
    String(Number.MAX_SAFE_INTEGER),
  );
});

test('row and cell limits reject excess data instead of truncating it', () => {
  const rows = Array.from({ length: LEAD_CSV_LIMITS.rows }, () => ['Synthetic']);
  expect(serializeLeadCsv(['Name'], rows).match(/Synthetic/g)).toHaveLength(1000);
  expect(() => serializeLeadCsv(['Name'], [...rows, ['Extra']])).toThrow(LeadCsvExportError);
  expect(() => serializeLeadCsv(['Name'], [['x'.repeat(4001)]])).toThrow(LeadCsvExportError);
});

test('the byte limit accounts for UTF-8 encoding and quote expansion', () => {
  for (const value of ['🏠'.repeat(2000), '"'.repeat(4000)]) {
    const rows = Array.from({ length: 600 }, () => [value]);
    expect(() => serializeLeadCsv(['Value'], rows)).toThrow('CSV size');
  }
});