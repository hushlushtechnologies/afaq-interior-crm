import { z } from 'zod';
import {
  importConfirmResultSchema,
  importPageSchema,
  importStageResultSchema,
  importUploadSchema,
  type ImportPage,
} from './contracts';

export type ImportUpload = z.infer<typeof importUploadSchema>;
export type ImportConfirmation = {
  requestId: string;
  batchId: string;
  version: number;
  skips: number[];
};
export class ImportClientError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
async function call<T>(url: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const body: unknown = await response.json();
    const failed = z
      .object({ status: z.literal('error'), message: z.string().max(500), retryable: z.boolean() })
      .safeParse(body);
    if (failed.success) throw new ImportClientError(failed.data.message, failed.data.retryable);
    const success = z.object({ status: z.literal('ok'), data: schema }).safeParse(body);
    if (!response.ok || !success.success) throw new Error();
    return success.data.data;
  } catch (error) {
    if (error instanceof ImportClientError) throw error;
    throw new ImportClientError(
      'The result could not be confirmed. Retry the same unchanged request.',
      true,
    );
  }
}
export function stageImport(metadata: ImportUpload, file: File) {
  return call(
    '/api/leads/imports',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-lead-import': encodeURIComponent(JSON.stringify(metadata)),
      },
      body: file,
    },
    importStageResultSchema,
  );
}
export function getImport(batchId: string, page: number): Promise<ImportPage> {
  return call(
    `/api/leads/imports?${new URLSearchParams({ batchId, page: String(page) })}`,
    { method: 'GET' },
    importPageSchema,
  );
}
export function confirmImport(command: ImportConfirmation) {
  return call(
    '/api/leads/imports',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(command),
    },
    importConfirmResultSchema,
  );
}
