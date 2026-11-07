import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  ATTACHMENT_MAX_BYTES,
  attachmentRemovalSchema,
  attachmentUploadSchema,
} from '../../src/features/lead-attachments/schemas';

const input = {
  requestId: randomUUID(),
  leadId: randomUUID(),
  filename: 'Site plan.pdf',
  declaredMime: 'application/pdf',
  declaredBytes: 100,
};

test('accepts only matching approved extension and MIME pairs', () => {
  for (const [filename, declaredMime] of [
    ['Plan.PDF', 'application/pdf'],
    ['Room.png', 'image/png'],
    ['Room.jpg', 'image/jpeg'],
    ['Room.jpeg', 'image/jpeg'],
    ['Room.webp', 'image/webp'],
  ]) {
    expect(attachmentUploadSchema.safeParse({ ...input, filename, declaredMime }).success).toBe(
      true,
    );
  }

  for (const [filename, declaredMime] of [
    ['Plan.svg', 'image/svg+xml'],
    ['Plan.html', 'text/html'],
    ['Plan.pdf.exe', 'application/pdf'],
    ['Plan.jpg', 'application/pdf'],
    ['Plan', 'application/pdf'],
  ]) {
    expect(attachmentUploadSchema.safeParse({ ...input, filename, declaredMime }).success).toBe(
      false,
    );
  }
});

test('rejects paths, invisible controls and unsafe display filenames', () => {
  for (const filename of [
    '../plan.pdf',
    'folder/plan.pdf',
    'folder\\plan.pdf',
    'C:plan.pdf',
    'plan\u0000.pdf',
    'plan\u202e.pdf',
    'plan\r\n.pdf',
    ' plan.pdf',
    '.plan.pdf',
    'CON.pdf',
    'LPT1.pdf',
    'a'.repeat(181) + '.pdf',
  ]) {
    expect(attachmentUploadSchema.safeParse({ ...input, filename }).success).toBe(false);
  }

  expect(attachmentUploadSchema.parse({ ...input, filename: 'مخطط.pdf' }).filename).toBe(
    'مخطط.pdf',
  );
});

test('enforces nonempty integer size with the existing 10 MiB ceiling', () => {
  for (const declaredBytes of [1, ATTACHMENT_MAX_BYTES]) {
    expect(attachmentUploadSchema.safeParse({ ...input, declaredBytes }).success).toBe(true);
  }

  for (const declaredBytes of [0, -1, 1.5, ATTACHMENT_MAX_BYTES + 1, Infinity, '100']) {
    expect(attachmentUploadSchema.safeParse({ ...input, declaredBytes }).success).toBe(false);
  }
});

test('rejects client attempts to claim identity, validation or storage authority', () => {
  for (const patch of [
    { actorId: randomUUID() },
    { storagePath: 'another-lead/plan.pdf' },
    { bucket: 'public' },
    { validated: true },
    { status: 'ready' },
    { requestId: 'invalid' },
    { leadId: 'invalid' },
  ]) {
    expect(attachmentUploadSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  }
});

test('removal requires explicit resource identity, request ID and safe version', () => {
  const removal = {
    leadId: randomUUID(),
    attachmentId: randomUUID(),
    requestId: randomUUID(),
    version: 1,
  };

  expect(attachmentRemovalSchema.parse(removal)).toEqual(removal);

  for (const patch of [
    { version: 0 },
    { version: Number.MAX_SAFE_INTEGER + 1 },
    { requestId: undefined },
    { actorId: randomUUID() },
  ]) {
    expect(attachmentRemovalSchema.safeParse({ ...removal, ...patch }).success).toBe(false);
  }
});
