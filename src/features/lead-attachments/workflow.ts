import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  attachmentReferenceSchema,
  attachmentRemovalSchema,
  attachmentUploadSchema,
} from './schemas';
import { validateAttachmentBytes } from './validate-file';

const storedSchema = z.object({
  id: z.uuid(),
  leadId: z.uuid(),
  state: z.enum(['pending', 'ready', 'failed', 'removed']),
  path: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(pdf|png|jpg|webp)$/),
  filename: z.string(),
  mime: z.string(),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

// Server implementation detail, not a Server Action. Never pass an actor from browser input.
// The entry point supplies the verified getUser() identity and a local-only admin client.
export function createAttachmentWorkflow(admin: SupabaseClient, actorId: string) {
  const actor = z.uuid().parse(actorId);
  const bucket = admin.storage.from('crm-private');
  async function gateway(operation: string, input: object) {
    const result = await admin.rpc('crm_attachment_gateway', {
      p_actor: actor,
      p_operation: operation,
      p_input: input,
    });
    if (result.error) {
      const messages: Record<string, string> = {
        '42501': 'Your current account cannot perform this attachment operation.',
        '40001': 'The attachment changed, expired or failed. Reload before retrying.',
        '22023': 'The attachment request or stored file does not match.',
        '54000': 'Upload limit reached. Please wait a minute before retrying.',
      };
      throw new Error(
        messages[result.error.code] ?? 'The result is unconfirmed. Retry the same request.',
      );
    }
    return result.data;
  }
  async function record(operation: string, input: object) {
    return storedSchema.parse(await gateway(operation, input));
  }
  return {
    async upload(input: unknown, bytes: Buffer) {
      const request = attachmentUploadSchema.parse(input);
      await gateway('check_upload', { leadId: request.leadId });
      const validated = await validateAttachmentBytes(request, bytes);
      const reservation = await record('reserve', {
        leadId: request.leadId,
        requestId: request.requestId,
        filename: validated.filename,
        mime: validated.mime,
        bytes: validated.size,
        sha256: validated.sha256,
      });
      const ref = { leadId: request.leadId, attachmentId: reservation.id };
      if (reservation.state === 'ready') return { id: reservation.id, state: 'ready' as const };
      if (reservation.state !== 'pending') {
        if (reservation.state === 'failed') await bucket.remove([reservation.path]);
        throw new Error('This upload failed or was removed. Start a new upload request.');
      }
      try {
        const uploaded = await bucket.upload(reservation.path, validated.bytes, {
          contentType: validated.mime,
          upsert: false,
          cacheControl: '0',
        });
        if (uploaded.error) {
          // A retry may find the object stored before a lost response. Never overwrite it.
          const previous = await bucket.download(reservation.path);
          if (previous.error || !previous.data || previous.data.size !== validated.size) {
            throw new Error('The file upload could not be confirmed.');
          }
          const hash = createHash('sha256')
            .update(Buffer.from(await previous.data.arrayBuffer()))
            .digest('hex');
          if (hash !== validated.sha256)
            throw new Error('The stored retry does not match this file.');
        }
        const saved = await record('finish', ref);
        return { id: saved.id, state: 'ready' as const };
      } catch {
        // Atomically fail only a pending upload. A committed retry is never deleted.
        try {
          const abandoned = await record('abandon', ref);
          if (abandoned.state === 'failed') await bucket.remove([abandoned.path]);
        } catch {
          // Unknown database/network outcome: keep the private object for reconciliation.
          // It cannot be exposed through the pending/failed metadata or employee Storage API.
        }
        throw new Error('Upload outcome is unconfirmed. Retry the same request and file.');
      }
    },
    async download(input: unknown) {
      const ref = attachmentReferenceSchema.parse(input);
      const file = await record('authorize_download', ref);
      const signed = await bucket.createSignedUrl(file.path, 60, { download: file.filename });
      if (signed.error || !signed.data) throw new Error('Download access could not be created.');
      // Recheck access and commit audit evidence before exposing the signed URL.
      await record('download_issued', ref);
      return { url: signed.data.signedUrl, expiresIn: 60 };
    },
    async remove(input: unknown) {
      const ref = attachmentRemovalSchema.parse(input);
      const file = await record('remove', ref);
      const removed = await bucket.remove([file.path]);
      if (removed.error)
        throw new Error('Access is removed, but object cleanup is pending. Retry removal.');
      return { id: file.id, state: 'removed' as const };
    },
  };
}
