import { writeFile } from 'node:fs/promises';
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  StandardFonts,
  decodePDFRawStream,
} from 'pdf-lib';
import { expect, test } from '@playwright/test';
import { renderDraftQuotationPdf } from '../../src/features/quotations/pdf-renderer';
import { draftPdfFixture } from '../helpers/quotation-pdf-fixtures';

async function inspect(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = document.getPages().map((page) => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
    const operationChunks: string[] = [];
    const text = streams
      .map((ref) => {
        const stream = document.context.lookup(ref);
        if (!(stream instanceof PDFRawStream)) return '';
        const operations = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
        operationChunks.push(operations);
        return [...operations.matchAll(/<([0-9a-f]+)>\s*Tj/gi)]
          .map((match) => Buffer.from(match[1], 'hex').toString('latin1'))
          .join('\n');
      })
      .join('\n');
    return { page, text, operations: operationChunks.join('\n') };
  });
  return { document, pages, text: pages.map((page) => page.text).join('\n') };
}

test('renders A4 draft identity, recorded financial values and safe metadata', async () => {
  const model = draftPdfFixture();
  const result = await renderDraftQuotationPdf(model);
  const pdf = await inspect(result.bytes);
  expect(result.pageCount).toBe(pdf.pages.length);
  expect(result.templateVersion).toBe('s19-english-a4-v1');
  for (const { page, text } of pdf.pages) {
    expect(page.getWidth()).toBeCloseTo(595.28, 2);
    expect(page.getHeight()).toBeCloseTo(841.89, 2);
    expect(text).toContain('DRAFT - NOT APPROVED FOR CLIENT DELIVERY');
    expect(text).toContain('Revision 2 | Saved version 3');
    expect(page.node.Annots()?.size() ?? 0).toBe(0);
  }
  expect(pdf.text).toContain('Synthetic customer');
  expect(pdf.text).toContain(`${model.totals.grandTotal} AED`);
  expect(pdf.text).toContain('100.123456');
  expect(pdf.text).not.toContain('INTERNAL_PDF_RENDER_SENTINEL_93');
  expect(pdf.document.catalog.has(PDFName.of('OpenAction'))).toBe(false);
  expect(pdf.document.getCreationDate()?.toISOString()).toBe(
    model.quotation.savedAt.replace('Z', '.000Z'),
  );
});

test('the same saved model produces deterministic PDF bytes', async () => {
  const model = draftPdfFixture();
  const a = await renderDraftQuotationPdf(model);
  const b = await renderDraftQuotationPdf(structuredClone(model));
  expect(Buffer.compare(Buffer.from(a.bytes), Buffer.from(b.bytes))).toBe(0);
});

test('long kerning-sensitive text stays inside the actual page margins', async () => {
  const model = draftPdfFixture();
  model.clientNotes = 'AVATARTo'.repeat(80);
  const pdf = await inspect((await renderDraftQuotationPdf(model)).bytes);
  const normal = await pdf.document.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.document.embedFont(StandardFonts.HelveticaBold);
  for (const { page, operations } of pdf.pages) {
    for (const block of operations.matchAll(/BT([\s\S]*?)ET/g)) {
      const matrix = /(?:^|\n)1 0 0 1 (-?[0-9.]+) (-?[0-9.]+) Tm/.exec(block[1]);
      const font = /\/([^ ]+) ([0-9.]+) Tf/.exec(block[1]);
      const encoded = /<([0-9a-f]+)>\s*Tj/i.exec(block[1]);
      if (!matrix || !font || !encoded) continue;
      const text = Buffer.from(encoded[1], 'hex').toString('latin1');
      const face = font[1].includes('Bold') ? bold : normal;
      const width = Array.from(text).reduce(
        (sum, character) => sum + face.widthOfTextAtSize(character, Number(font[2])),
        0,
      );
      expect(Number(matrix[1])).toBeGreaterThanOrEqual(42 - 0.01);
      expect(Number(matrix[1]) + width).toBeLessThanOrEqual(page.getWidth() - 42 + 0.01);
    }
  }
});

test('paginates long items and notes with repeated headers, continuations and correct page numbers', async ({}, info) => {
  const model = draftPdfFixture(
    12,
    'Detailed synthetic scope with material and finishing requirements. '.repeat(7),
  );
  model.clientNotes = `LONGNOTE_START ${'Recorded client note. '.repeat(140)} LONGNOTE_END`;
  model.terms = `${'UnbrokenToken'.repeat(60)} TERMS_END`;
  const result = await renderDraftQuotationPdf(model);
  const pdf = await inspect(result.bytes);
  expect(result.pageCount).toBeGreaterThan(2);
  pdf.pages.forEach(({ text }, index) => {
    expect(text).toContain(`Page ${index + 1} of ${result.pageCount}`);
    expect(text).toContain(model.quotation.number);
  });
  expect(pdf.text).toContain('LONGNOTE_START');
  expect(pdf.text).toContain('LONGNOTE_END');
  expect(pdf.text).toContain('TERMS_END');
  expect(pdf.text.replace(/\s/g, '')).toContain('UnbrokenToken'.repeat(60));
  const file = info.outputPath('synthetic-draft.pdf');
  await writeFile(file, result.bytes);
  await info.attach('Synthetic multi-page draft', { path: file, contentType: 'application/pdf' });
});

test('an item spanning several pages retains every segment', async () => {
  const model = draftPdfFixture(1);
  model.lines[0].description = `${'Item description across pages. '.repeat(200)} ITEM_TAIL`;
  const result = await renderDraftQuotationPdf(model);
  const pdf = await inspect(result.bytes);
  expect(result.pageCount).toBeGreaterThan(2);
  expect(pdf.text).toContain('Item 1 (continued)');
  expect(pdf.text).toContain('ITEM_TAIL');
  expect(pdf.pages.filter(({ text }) => text.includes('Description')).length).toBeGreaterThan(1);
});

test('zero-item drafts retain zero totals and nullable values', async () => {
  const model = draftPdfFixture(0);
  model.customer.phone = null;
  model.companyVatNumber = null;
  const pdf = await inspect((await renderDraftQuotationPdf(model)).bytes);
  expect(pdf.text).toContain('No line items recorded.');
  expect(pdf.text).toContain('Grand total');
  expect(pdf.text).toContain('0.00 AED');
  expect(pdf.text).toContain('Not recorded');
});

test('same-name room groups and item order are preserved', async () => {
  const model = draftPdfFixture(3);
  model.lines[0].description = 'ORDER_A';
  model.lines[1].description = 'ORDER_B';
  model.lines[1].sectionId = '00000000-0000-4000-8000-000000000099';
  model.lines[2].description = 'ORDER_C';
  model.lines[2].sectionId = null;
  model.lines[2].sectionName = null;
  const pdf = await inspect((await renderDraftQuotationPdf(model)).bytes);
  expect(pdf.text.indexOf('ORDER_A')).toBeLessThan(pdf.text.indexOf('ORDER_B'));
  expect(pdf.text.indexOf('ORDER_B')).toBeLessThan(pdf.text.indexOf('ORDER_C'));
  expect(pdf.text.match(/Living room/g)?.length).toBe(2);
  expect(pdf.text).toContain('Ungrouped work');
});

test('large totals and fractional quantities retain their exact text', async () => {
  const model = draftPdfFixture(1);
  // Isolate display fidelity; authoritative arithmetic is tested in the model layer.
  model.totals.grandTotal = '9007199254740990.01';
  model.lines[0].quantity = '12345.6789';
  const pdf = await inspect((await renderDraftQuotationPdf(model)).bytes);
  expect(pdf.text).toContain('9,007,199,254,740,990.01 AED');
  expect(pdf.text.replace(/\s/g, '')).toContain('12345.6789');
});

test('unsupported Arabic and emoji fail without exposing the source text', async () => {
  for (const value of ['عميل تجريبي', 'Fixture 😀']) {
    const model = draftPdfFixture();
    model.customer.name = value;
    await expect(renderDraftQuotationPdf(model)).rejects.toThrow('needs a Unicode font');
    try {
      await renderDraftQuotationPdf(model);
    } catch (error) {
      expect(String(error)).not.toContain(value);
    }
  }
});

test('control characters and excessive text/pages are rejected', async () => {
  const control = draftPdfFixture();
  control.clientNotes = 'Bad\u0000text';
  await expect(renderDraftQuotationPdf(control)).rejects.toThrow('control character');
  const huge = draftPdfFixture();
  huge.clientNotes = 'x'.repeat(600001);
  await expect(renderDraftQuotationPdf(huge)).rejects.toThrow('text resource limit');
  const pages = draftPdfFixture();
  pages.clientNotes = 'x\n'.repeat(7000);
  await expect(renderDraftQuotationPdf(pages)).rejects.toThrow('80-page');
});

test('literal special characters stay text and rendering does not mutate the model', async () => {
  const model = draftPdfFixture();
  model.clientNotes = 'Scope (v1) \\ details\tEND';
  const original = JSON.stringify(model);
  const pdf = await inspect((await renderDraftQuotationPdf(model)).bytes);
  expect(pdf.text).toContain('Scope (v1) \\ details    END');
  expect(JSON.stringify(model)).toBe(original);
});