import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { expect, test } from '@playwright/test';
import { validateAttachmentBytes } from '../../src/features/lead-attachments/validate-file';

function input(bytes: Buffer, mime: string, extension: string) {
  return {
    requestId: randomUUID(),
    leadId: randomUUID(),
    filename: `Example.${extension}`,
    declaredMime: mime,
    declaredBytes: bytes.length,
  };
}

test('decodes and re-encodes all approved image formats without metadata', async () => {
  for (const [format, mime, extension] of [
    ['png', 'image/png', 'png'],
    ['jpeg', 'image/jpeg', 'jpg'],
    ['webp', 'image/webp', 'webp'],
  ] as const) {
    const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } })
      .withMetadata()
      .toFormat(format)
      .toBuffer();
    const result = await validateAttachmentBytes(input(bytes, mime, extension), bytes);
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.format).toBe(format);
    expect(metadata.exif).toBeUndefined();
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.size).toBe(result.bytes.length);
  }
});

test('rejects signature mismatches, dishonest lengths and malformed image data', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'white' } })
    .png()
    .toBuffer();
  await expect(validateAttachmentBytes(input(png, 'image/jpeg', 'jpg'), png)).rejects.toThrow();
  await expect(
    validateAttachmentBytes({ ...input(png, 'image/png', 'png'), declaredBytes: 1 }, png),
  ).rejects.toThrow();
  const truncated = png.subarray(0, 32);
  await expect(
    validateAttachmentBytes(input(truncated, 'image/png', 'png'), truncated),
  ).rejects.toThrow();
});

test('rejects oversized image dimensions before re-encoding', async () => {
  const bytes = await sharp({
    create: { width: 8193, height: 1, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await expect(validateAttachmentBytes(input(bytes, 'image/png', 'png'), bytes)).rejects.toThrow();
});

test('accepts a static PDF without modifying its bytes', async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  const bytes = Buffer.from(await doc.save());
  const result = await validateAttachmentBytes(input(bytes, 'application/pdf', 'pdf'), bytes);
  expect(result.bytes.equals(bytes)).toBe(true);
});

test('rejects malformed PDFs and active content inside compressed objects', async () => {
  const malformed = Buffer.from('%PDF-1.7\nnot a document\n%%EOF');
  await expect(
    validateAttachmentBytes(input(malformed, 'application/pdf', 'pdf'), malformed),
  ).rejects.toThrow();
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.catalog.set(
    PDFName.of('OpenAction'),
    doc.context.obj({
      S: PDFName.of('JavaScript'),
      JS: PDFString.of('app.alert("test")'),
    }),
  );
  const bytes = Buffer.from(await doc.save({ useObjectStreams: true }));
  await expect(
    validateAttachmentBytes(input(bytes, 'application/pdf', 'pdf'), bytes),
  ).rejects.toThrow();
});