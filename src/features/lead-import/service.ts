import 'server-only';
import { z } from 'zod';
import { requireCapability } from '@/features/access/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CSV_LIMITS, LeadCsvError } from './csv';
import {
  importConfirmInputSchema,
  importConfirmResultSchema,
  importPageInputSchema,
  importPageSchema,
  importStageResultSchema,
} from './contracts';
import { prepareLeadImport } from './prepare';

export class ImportOperationError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}
export async function authorizeImport() {
  try {
    await requireCapability('leads.create');
    await requireCapability('leads.view');
  } catch {
    throw new ImportOperationError(403, 'Your current session cannot access lead imports.');
  }
}
function databaseFailure(code?: string): never {
  if (code === '40001')
    throw new ImportOperationError(409, 'Reload the batch and review its current state.');
  if (code === '42501') throw new ImportOperationError(403, 'Import access could not be verified.');
  if (code === 'P0001')
    throw new ImportOperationError(429, 'Wait one minute before staging another import.', true);
  if (['22023', '23514', '22P02', '22007', '22008', '22003', '23503'].includes(code ?? '')) {
    throw new ImportOperationError(400, 'Review the file, mapping, source and eligible owner.');
  }
  throw new ImportOperationError(
    503,
    'The result is uncertain. Retry with the same request ID and file.',
    true,
  );
}
async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const client = await createSupabaseServerClient();
  const response = await client.rpc(name, args);
  if (response.error) databaseFailure(response.error.code);
  const parsed = schema.safeParse(response.data);
  if (!parsed.success) databaseFailure();
  return parsed.data;
}
export async function stageLeadImport(input: unknown, bytes: Uint8Array) {
  await authorizeImport();
  try {
    const prepared = await prepareLeadImport(input, bytes);
    return await rpc(
      'crm_stage_lead_import',
      {
        p_request_id: prepared.requestId,
        p_input: prepared.payload,
      },
      importStageResultSchema,
    );
  } catch (error) {
    if (error instanceof LeadCsvError) throw new ImportOperationError(400, error.message);
    if (error instanceof z.ZodError)
      throw new ImportOperationError(400, 'Review the import metadata and mapping.');
    throw error;
  }
}
export async function loadLeadImport(input: unknown) {
  await authorizeImport();
  const parsed = importPageInputSchema.safeParse(input);
  if (!parsed.success) throw new ImportOperationError(400, 'Choose a valid import page.');
  return rpc(
    'crm_lead_import_page',
    {
      p_batch_id: parsed.data.batchId,
      p_page: parsed.data.page,
    },
    importPageSchema,
  );
}
export async function confirmLeadImport(input: unknown) {
  await authorizeImport();
  const parsed = importConfirmInputSchema.safeParse(input);
  if (!parsed.success)
    throw new ImportOperationError(400, 'Review the explicit skip selection and batch version.');
  return rpc(
    'crm_confirm_lead_import',
    {
      p_request_id: parsed.data.requestId,
      p_batch_id: parsed.data.batchId,
      p_version: parsed.data.version,
      p_skips: parsed.data.skips,
    },
    importConfirmResultSchema,
  );
}
export async function readImportBody(request: Request, maxBytes: number = CSV_LIMITS.bytes) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > maxBytes)) {
    throw new ImportOperationError(413, 'Import request body exceeds its size limit.');
  }
  if (!request.body) throw new ImportOperationError(400, 'Choose a nonempty CSV file.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ImportOperationError(408, 'Import request timed out.', true)),
      15000,
    );
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes)
        throw new ImportOperationError(413, 'Import request body exceeds its size limit.');
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
