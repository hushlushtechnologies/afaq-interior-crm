import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { serializeLeadCsv, LeadCsvExportError } from './csv';
import { exportQuerySchema, exportSnapshotSchema, LEAD_EXPORT_HEADERS } from './contracts';

export class ExportError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authorizeExport() {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ExportError(401, 'Sign in again before exporting.');
  return client;
}
export async function prepareExport(input: unknown) {
  const parsed = exportQuerySchema.safeParse(input);
  if (!parsed.success) throw new ExportError(400, 'Review the applied lead filters.');
  const client = await authorizeExport();
  const { data, error } = await client.rpc('crm_lead_export', { p_query: parsed.data });
  if (error) {
    if (error.code === '42501')
      throw new ExportError(403, 'Your current account cannot export these leads.');
    if (error.code === 'P0001')
      throw new ExportError(429, 'Export limit reached. Wait one minute and try again.');
    if (error.code === '54000')
      throw new ExportError(413, 'More than 1,000 leads match. Narrow the filters.');
    if (error.code === '22023') throw new ExportError(400, 'Review the applied lead filters.');
    throw new ExportError(503, 'The export snapshot could not be verified. Try again.');
  }
  const snapshot = exportSnapshotSchema.safeParse(data);
  if (!snapshot.success) throw new ExportError(503, 'The export snapshot could not be verified.');
  try {
    return {
      id: snapshot.data.id,
      count: snapshot.data.rows.length,
      csv: serializeLeadCsv(LEAD_EXPORT_HEADERS, snapshot.data.rows),
    };
  } catch (error) {
    if (error instanceof LeadCsvExportError)
      throw new ExportError(
        422,
        'The matching data cannot be represented within the CSV limits. Narrow the filters or review invalid values.',
      );
    throw error;
  }
}

export async function readExportBody(request: Request) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192))
    throw new ExportError(413, 'Export filters exceed the request size limit.');
  if (!request.body) throw new ExportError(400, 'Provide the applied filters.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ExportError(408, 'Export request timed out.')), 15000);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > 8192) throw new ExportError(413, 'Export filters exceed the request size limit.');
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      throw new ExportError(400, 'Provide valid JSON export filters.');
    }
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}