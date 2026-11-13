/** Pure formatting only. This module grants no access and performs no database reads. */
export const LEAD_CSV_LIMITS = {
  rows: 1000,
  columns: 32,
  cellCharacters: 4000,
  bytes: 4 * 1024 * 1024,
} as const;

type CsvValue = string | number | null;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export class LeadCsvExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeadCsvExportError';
  }
}

function cell(value: CsvValue): string {
  if (value !== null && typeof value !== 'string' && typeof value !== 'number')
    throw new LeadCsvExportError('Unsupported CSV value.');
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
  )
    throw new LeadCsvExportError('CSV numbers must be finite and within the safe numeric range.');
  const text = value === null ? '' : String(value);
  if (text.length > LEAD_CSV_LIMITS.cellCharacters)
    throw new LeadCsvExportError('A CSV cell exceeds the supported length.');
  if (/\p{Cc}/u.test(text.replaceAll('\t', '').replaceAll('\r', '').replaceAll('\n', '')))
    throw new LeadCsvExportError('A CSV cell contains unsupported control characters.');
  if (decoder.decode(encoder.encode(text)) !== text)
    throw new LeadCsvExportError('A CSV cell contains malformed Unicode.');

  // Detect compatibility characters and concealed formula prefixes without changing evidence.
  const probe = text.normalize('NFKC').replace(/^[\s\p{Cc}\p{Cf}]*/u, '');
  const dangerous = /^[=+\-@]/u.test(probe) || /^[\s\p{Cf}]*[\t\r\n]/u.test(text);
  const safe = dangerous ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function serializeLeadCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  if (
    headers.length === 0 ||
    headers.length > LEAD_CSV_LIMITS.columns ||
    headers.some((header) => typeof header !== 'string' || !header.trim()) ||
    new Set(headers).size !== headers.length
  )
    throw new LeadCsvExportError('Choose distinct, nonempty CSV columns within the limit.');
  if (rows.length > LEAD_CSV_LIMITS.rows)
    throw new LeadCsvExportError('Narrow the filters before exporting this many rows.');

  const lines: string[] = ['\uFEFF'];
  let bytes = encoder.encode(lines[0]).byteLength;
  function append(values: readonly CsvValue[]) {
    if (values.length !== headers.length)
      throw new LeadCsvExportError('CSV row width does not match the columns.');
    const line = `${values.map(cell).join(',')}\r\n`;
    bytes += encoder.encode(line).byteLength;
    if (bytes > LEAD_CSV_LIMITS.bytes)
      throw new LeadCsvExportError('Narrow the filters to reduce the CSV size.');
    lines.push(line);
  }
  append(headers);
  rows.forEach(append);
  return lines.join('');
}