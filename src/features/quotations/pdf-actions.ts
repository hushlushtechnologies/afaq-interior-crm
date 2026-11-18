'use server';

import { z } from 'zod';
import type { Result } from '@/features/leads/schemas';
import { loadDraftQuotationPdfModel } from './pdf-model-service';
import { getLocalDraftPdfWorkflow } from './pdf-local-service';
import { DraftPdfOperationError } from './pdf-workflow';
import { DraftPdfRenderError } from './pdf-renderer';

const requestSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().min(1).max(2147483647),
    requestId: z.uuid(),
  })
  .strict();

function failure(error: unknown): Result<never> {
  if (error instanceof DraftPdfOperationError || error instanceof DraftPdfRenderError)
    return {
      status: 'error',
      message: error.message,
      retryable: error instanceof DraftPdfOperationError && error.retryable,
    };
  return {
    status: 'error',
    message: 'PDF operation could not be confirmed. Reload or retry.',
    retryable: true,
  };
}

export async function prepareInternalDraftPdf(
  input: unknown,
): Promise<Result<{ documentId: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Choose a valid saved quotation version.',
      retryable: false,
    };
  try {
    const workflow = await getLocalDraftPdfWorkflow();
    const model = await loadDraftQuotationPdfModel({
      id: parsed.data.id,
      version: parsed.data.version,
    });
    if (model.status === 'error') return model;
    return { status: 'ok', data: await workflow.generate(parsed.data.requestId, model.data) };
  } catch (error) {
    return failure(error);
  }
}

export async function requestInternalDraftPdfDownload(
  input: unknown,
): Promise<Result<{ url: string; expiresAt: number }>> {
  const parsed = z.object({ documentId: z.uuid() }).strict().safeParse(input);
  if (!parsed.success)
    return { status: 'error', message: 'Choose a prepared draft PDF.', retryable: false };
  try {
    return {
      status: 'ok',
      data: await (await getLocalDraftPdfWorkflow()).download(parsed.data.documentId),
    };
  } catch (error) {
    return failure(error);
  }
}