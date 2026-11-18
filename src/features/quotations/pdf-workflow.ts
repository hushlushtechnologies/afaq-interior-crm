import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { DraftQuotationPdfModel } from './pdf-model';
import { renderDraftQuotationPdf } from './pdf-renderer';

export class DraftPdfOperationError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = 'DraftPdfOperationError';
  }
}

const storedSchema = z.object({
  id: z.uuid(),
  quotationId: z.uuid(),
  version: z.number().int().positive(),
  state: z.enum(['pending', 'ready', 'failed']),
  path: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.pdf$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().min(1).max(10485760),
  pages: z.number().int().min(1).max(80),
  template: z.literal('s19-english-a4-v1'),
});
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Internal implementation. The server entry point supplies getUser() identity.
 * The model must come from loadDraftQuotationPdfModel, never browser input.
 */
export function createDraftPdfWorkflow(admin: SupabaseClient, actorId: string) {
  const actor = z.uuid().parse(actorId);
  const bucket = admin.storage.from('crm-quotation-drafts');
  async function record(operation: string, input: object) {
    const response = await admin.rpc('crm_draft_pdf_gateway', {
      p_actor: actor,
      p_operation: operation,
      p_input: input,
    });
    if (response.error) {
      const code = response.error.code;
      throw new DraftPdfOperationError(
        code === '42501'
          ? 'PDF access is unavailable. Reload or sign in again.'
          : code === '54000'
            ? 'PDF limit reached. Wait one minute before retrying.'
            : code === '22023'
              ? 'PDF data could not be confirmed. Reload before retrying.'
              : 'PDF outcome is unconfirmed. Retry the same request.',
        !['42501', '22023'].includes(code),
      );
    }
    return storedSchema.parse(response.data);
  }
  return {
    async generate(requestId: string, model: DraftQuotationPdfModel) {
      z.uuid().parse(requestId);
      const rendered = await renderDraftQuotationPdf(model);
      const digest = hash(rendered.bytes);
      const reservation = await record('reserve', {
        quotationId: model.quotation.id,
        version: model.quotation.savedVersion,
        requestId,
        template: rendered.templateVersion,
        sha256: digest,
        bytes: rendered.bytes.length,
        pages: rendered.pageCount,
      });
      const ref = { documentId: reservation.id };
      if (reservation.state === 'ready') return ref;
      if (reservation.state === 'failed') {
        // Only an already failed artifact may be cleaned up on this path.
        await bucket.remove([reservation.path]);
        throw new DraftPdfOperationError('This PDF attempt failed. Start a new request.', false);
      }
      try {
        const upload = await bucket.upload(reservation.path, rendered.bytes, {
          contentType: 'application/pdf',
          upsert: false,
          cacheControl: '0',
        });
        if (upload.error) {
          // Lost upload response or concurrent retry: verify bytes, never overwrite.
          const previous = await bucket.download(reservation.path);
          if (
            previous.error ||
            !previous.data ||
            previous.data.size !== rendered.bytes.length ||
            hash(new Uint8Array(await previous.data.arrayBuffer())) !== digest
          )
            throw new DraftPdfOperationError('The uploaded PDF could not be confirmed.');
        }
        const finished = await record('finish', ref);
        if (finished.state !== 'ready') throw new DraftPdfOperationError('PDF is not ready.');
        return ref;
      } catch {
        try {
          const abandoned = await record('abandon', ref);
          // Another retry may have committed before the failed response arrived.
          if (abandoned.state === 'ready') return ref;
          if (abandoned.state === 'failed') {
            const cleanup = await bucket.remove([abandoned.path]);
            throw new DraftPdfOperationError(
              cleanup.error
                ? 'PDF failed; private cleanup is pending. Start a new request.'
                : 'PDF preparation failed. Start a new request.',
              false,
            );
          }
        } catch (error) {
          if (error instanceof DraftPdfOperationError && !error.retryable) throw error;
          // Unknown database outcome: keep the private object for reconciliation.
        }
        throw new DraftPdfOperationError('PDF outcome is unconfirmed. Retry the same request.');
      }
    },
    async download(documentId: string) {
      const ref = { documentId: z.uuid().parse(documentId) };
      const file = await record('authorize_download', ref);
      const expiresAt = Date.now() + 60000;
      const signed = await bucket.createSignedUrl(file.path, 60, {
        download: `quotation-draft-${file.id}.pdf`,
      });
      if (signed.error || !signed.data)
        throw new DraftPdfOperationError('Download access could not be created. Retry.');
      const url = new URL(signed.data.signedUrl);
      if (
        url.origin !== 'http://127.0.0.1:57421' ||
        !url.pathname.startsWith('/storage/v1/object/sign/crm-quotation-drafts/')
      )
        throw new DraftPdfOperationError('The local download address is invalid.', false);
      // Do not expose a signed URL if the final authorization/audit commit fails.
      await record('download_issued', ref);
      return { url: url.href, expiresAt };
    },
  };
}