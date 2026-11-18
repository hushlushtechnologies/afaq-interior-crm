import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { DraftQuotationPdfModel } from './pdf-model';

export class DraftPdfRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftPdfRenderError';
  }
}

const PAGE = { width: 595.28, height: 841.89, margin: 42, bottom: 58, top: 730 };
const WIDTH = PAGE.width - PAGE.margin * 2;
const MAX_PAGES = 80;
const MAX_BYTES = 10 * 1024 * 1024;
const WARNING = 'DRAFT - NOT APPROVED FOR CLIENT DELIVERY';
const COLORS = {
  ink: rgb(48 / 255, 40 / 255, 32 / 255),
  accent: rgb(150 / 255, 119 / 255, 92 / 255),
  line: rgb(231 / 255, 221 / 255, 208 / 255),
  surface: rgb(239 / 255, 232 / 255, 223 / 255),
  white: rgb(1, 1, 1),
};
const COLUMNS = [198, 45, 46, 86, 60, WIDTH - 435];
const HEADERS = ['Description', 'Qty', 'Unit', 'Unit price AED', 'VAT AED', 'Total AED'];
const PAD = 6;
const LEADING = 12;
const HEADER_HEIGHT = 34;
const decimal = (value: string) => {
  const [whole, fraction] = value.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
};
const money = (value: string) => `${decimal(value)} AED`;
const rate = (value: string) => value.replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '');

/** English/WinAnsi draft renderer. Accept only the authorized model from Part 3A. */
export async function renderDraftQuotationPdf(model: DraftQuotationPdfModel) {
  try {
    if (
      model.documentKind !== 'internal_draft' ||
      model.templateVersion !== 's19-internal-draft-v1'
    )
      throw new DraftPdfRenderError('Choose a verified internal draft quotation.');
    const savedAt = new Date(model.quotation.savedAt);
    if (!Number.isFinite(savedAt.getTime()))
      throw new DraftPdfRenderError('The saved-version timestamp is invalid.');
    const savedDubai = new Date(savedAt.getTime() + 4 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ');
    const document = await PDFDocument.create({ updateMetadata: false });
    const normal = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    // drawText emits a Tj string without pair-kerning adjustments. Measure glyph
    // advances individually so long text cannot exceed its column after rendering.
    const measure = (value: string, font: PDFFont, size: number) =>
      Array.from(value).reduce(
        (width, character) => width + font.widthOfTextAtSize(character, size),
        0,
      );
    document.setTitle(`${model.quotation.number} - Revision ${model.quotation.revision} - DRAFT`);
    document.setAuthor('Afaq Al Manzel Interiors CRM');
    document.setCreator('Afaq Al Manzel Interiors CRM');
    document.setProducer('Afaq Al Manzel Interiors CRM');
    document.setSubject('Internal saved draft; not approved for client delivery');
    // Source timestamps make repeated rendering deterministic, not an issuance timestamp.
    document.setCreationDate(savedAt);
    document.setModificationDate(savedAt);
    let page: PDFPage;
    let cursor = PAGE.top;
    let tableActive = false;
    let characters = 0;

    function clean(value: string) {
      characters += value.length;
      if (characters > 600000)
        throw new DraftPdfRenderError('The draft exceeds the PDF text resource limit.');
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
        throw new DraftPdfRenderError('The saved text contains an unsupported control character.');
      const text = value.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
      try {
        normal.encodeText(text.replace(/\n/g, ''));
      } catch {
        throw new DraftPdfRenderError(
          'Some saved text needs a Unicode font. English-only draft rendering cannot export it yet.',
        );
      }
      return text;
    }
    function wrap(value: string, font: PDFFont, size: number, width: number) {
      const lines: string[] = [];
      for (let remaining of clean(value).split('\n')) {
        if (!remaining) {
          lines.push('');
          continue;
        }
        while (remaining) {
          let fit = 0;
          let used = 0;
          while (fit < remaining.length && used + measure(remaining[fit], font, size) <= width) {
            used += measure(remaining[fit], font, size);
            fit += 1;
          }
          if (!fit) throw new DraftPdfRenderError('The text cannot fit within its PDF column.');
          if (fit === remaining.length) {
            lines.push(remaining);
            break;
          }
          const space = remaining.lastIndexOf(' ', fit);
          const cut = space > 0 ? space : fit;
          lines.push(remaining.slice(0, cut).trimEnd());
          remaining = remaining.slice(cut).replace(/^ +/, '');
        }
      }
      return lines;
    }
    function draw(value: string, x: number, y: number, size = 10, strong = false) {
      page.drawText(value, { x, y, size, font: strong ? bold : normal, color: COLORS.ink });
    }
    function newPage() {
      if (document.getPageCount() >= MAX_PAGES)
        throw new DraftPdfRenderError(
          `The draft exceeds the ${MAX_PAGES}-page PDF resource limit.`,
        );
      page = document.addPage([PAGE.width, PAGE.height]);
      page.drawText('DRAFT', {
        x: 130,
        y: 340,
        size: 90,
        font: bold,
        color: COLORS.accent,
        rotate: degrees(35),
        opacity: 0.07,
      });
      draw('Afaq Al Manzel Interiors CRM', PAGE.margin, 800, 12, true);
      draw(clean(model.quotation.number), PAGE.margin, 781, 10, true);
      draw(
        `Revision ${model.quotation.revision} | Saved version ${model.quotation.savedVersion}`,
        PAGE.margin,
        765,
        9,
      );
      draw(WARNING, PAGE.margin, 749, 9, true);
      page.drawLine({
        start: { x: PAGE.margin, y: 741 },
        end: { x: PAGE.width - PAGE.margin, y: 741 },
        color: COLORS.line,
        thickness: 1,
      });
      cursor = PAGE.top;
    }
    function tableHeader() {
      page.drawRectangle({
        x: PAGE.margin,
        y: cursor - HEADER_HEIGHT,
        width: WIDTH,
        height: HEADER_HEIGHT,
        color: COLORS.surface,
      });
      let x = PAGE.margin;
      HEADERS.forEach((heading, index) => {
        wrap(heading, bold, 9, COLUMNS[index] - PAD * 2).forEach((line, row) =>
          draw(line, x + PAD, cursor - PAD - 9 - row * LEADING, 9, true),
        );
        x += COLUMNS[index];
      });
      cursor -= HEADER_HEIGHT;
    }
    function ensure(height: number) {
      if (cursor - height < PAGE.bottom) {
        newPage();
        if (tableActive) tableHeader();
      }
    }
    function paragraph(value: string, size = 10, strong = false, gap = 5) {
      const leading = size + 4;
      for (const line of wrap(value, strong ? bold : normal, size, WIDTH)) {
        ensure(leading);
        draw(line, PAGE.margin, cursor - size, size, strong);
        cursor -= leading;
      }
      cursor -= gap;
    }
    function sectionHeading(value: string) {
      const lines = wrap(value, bold, 10, WIDTH - PAD * 2);
      const height = lines.length * LEADING + PAD * 2;
      ensure(height + LEADING + PAD * 2);
      page.drawRectangle({
        x: PAGE.margin,
        y: cursor - height,
        width: WIDTH,
        height,
        color: COLORS.surface,
      });
      lines.forEach((line, row) =>
        draw(line, PAGE.margin + PAD, cursor - PAD - 10 - row * LEADING, 10, true),
      );
      cursor -= height;
    }
    function itemRow(values: string[], number: number) {
      const cells = values.map((value, index) => wrap(value, normal, 9, COLUMNS[index] - PAD * 2));
      const count = Math.max(...cells.map((cell) => cell.length));
      let offset = 0;
      while (offset < count) {
        const continued = offset > 0;
        ensure(PAD * 2 + LEADING * (continued ? 2 : 1));
        const available =
          Math.floor((cursor - PAGE.bottom - PAD * 2) / LEADING) - (continued ? 1 : 0);
        const take = Math.min(count - offset, available);
        if (take < 1) throw new DraftPdfRenderError('The PDF row could not be paginated safely.');
        const height = PAD * 2 + LEADING * (take + (continued ? 1 : 0));
        page.drawRectangle({
          x: PAGE.margin,
          y: cursor - height,
          width: WIDTH,
          height,
          color: COLORS.white,
        });
        if (continued)
          draw(`Item ${number} (continued)`, PAGE.margin + PAD, cursor - PAD - 9, 9, true);
        let x = PAGE.margin;
        cells.forEach((cell, column) => {
          cell
            .slice(offset, offset + take)
            .forEach((line, row) =>
              draw(line, x + PAD, cursor - PAD - 9 - LEADING * (row + (continued ? 1 : 0)), 9),
            );
          x += COLUMNS[column];
        });
        page.drawLine({
          start: { x: PAGE.margin, y: cursor - height },
          end: { x: PAGE.width - PAGE.margin, y: cursor - height },
          color: COLORS.line,
          thickness: 0.5,
        });
        cursor -= height;
        offset += take;
      }
    }

    newPage();
    paragraph(clean(model.quotation.title), 16, true, 10);
    paragraph(`Customer: ${model.customer.name}`, 11, true);
    paragraph(
      `Email: ${model.customer.email ?? 'Not recorded'} | Phone: ${model.customer.phone ?? 'Not recorded'}`,
    );
    paragraph(`Lead reference: ${model.customer.leadReference}`);
    paragraph(`Property type: ${model.customer.propertyType ?? 'Not recorded'}`);
    paragraph(`Project location: ${model.customer.location ?? 'Not recorded'}`);
    paragraph(
      `Quotation date: ${model.quotation.quotationDate} | Validity date: ${model.quotation.validUntil ?? 'Not recorded'}`,
    );
    paragraph(
      `Currency: ${model.quotation.currency} | Company VAT number (recorded): ${model.companyVatNumber ?? 'Not recorded'}`,
    );
    paragraph('Unit prices exclude VAT. Totals reflect the recorded tax treatment.', 9, false, 10);

    ensure(HEADER_HEIGHT + LEADING + PAD * 2);
    tableActive = true;
    tableHeader();
    let previousSection: string | null | undefined;
    model.lines.forEach((line, index) => {
      if (line.sectionId !== previousSection) {
        sectionHeading(line.sectionName ?? 'Ungrouped work');
        previousSection = line.sectionId;
      }
      const detail = [`${index + 1}. ${line.description}`, `Subtotal: ${money(line.subtotal)}`];
      if (line.discount.mode !== 'none') {
        const basis = line.discount.mode === 'percent' ? `${rate(line.discount.rate)}%` : 'fixed';
        detail.push(`Line discount (${basis}): ${money(line.lineDiscount)}`);
      }
      if (line.overallDiscount !== '0.00')
        detail.push(`Quotation discount share: ${money(line.overallDiscount)}`);
      const treatment =
        line.taxTreatment === 'taxable'
          ? `${rate(line.taxRate)}%`
          : line.taxTreatment === 'zero_rated'
            ? 'Zero-rated'
            : 'Exempt';
      itemRow(
        [
          detail.join('\n'),
          line.quantity,
          line.unit,
          decimal(line.unitPrice),
          `${treatment}\n${decimal(line.tax)}`,
          decimal(line.total),
        ],
        index + 1,
      );
    });
    tableActive = false;
    if (!model.lines.length) paragraph('No line items recorded.', 10, false, 8);
    cursor -= 12;
    if (model.overallDiscount.mode !== 'none')
      paragraph(
        `Quotation discount basis: ${
          model.overallDiscount.mode === 'percent'
            ? `${rate(model.overallDiscount.rate)}%`
            : money(model.overallDiscount.amount)
        }`,
        9,
      );
    const totals = [
      ['Subtotal', model.totals.subtotal],
      ['Line discounts', model.totals.lineDiscount],
      ['After line discounts', model.totals.netSubtotal],
      ['Quotation discount', model.totals.overallDiscount],
      ['Net before VAT', model.totals.net],
      ['VAT total', model.totals.tax],
      ['Grand total', model.totals.grandTotal],
    ];
    ensure(totals.length * 22 + 12);
    totals.forEach(([label, amount], index) => {
      const strong = index === totals.length - 1;
      if (strong)
        page.drawRectangle({
          x: PAGE.margin,
          y: cursor - 22,
          width: WIDTH,
          height: 24,
          color: COLORS.surface,
        });
      draw(label, PAGE.margin + PAD, cursor - 13, 11, strong);
      const value = money(amount);
      draw(
        value,
        PAGE.width - PAGE.margin - PAD - measure(value, strong ? bold : normal, 11),
        cursor - 13,
        11,
        strong,
      );
      cursor -= 22;
    });
    cursor -= 14;
    const notes: Array<[string, string | null]> = [
      ['Client-facing notes', model.clientNotes],
      ['Payment terms', model.paymentTerms],
      ['Terms and conditions', model.terms],
    ];
    for (const [heading, value] of notes) {
      if (value !== null) {
        ensure(38);
        paragraph(heading, 11, true);
        paragraph(value, 10, false, 10);
      }
    }
    const pages = document.getPages();
    pages.forEach((current, index) => {
      current.drawLine({
        start: { x: PAGE.margin, y: 43 },
        end: { x: PAGE.width - PAGE.margin, y: 43 },
        color: COLORS.line,
        thickness: 0.5,
      });
      current.drawText(`Saved ${savedDubai} (Dubai)`, {
        x: PAGE.margin,
        y: 28,
        size: 8,
        font: normal,
        color: COLORS.ink,
      });
      const count = `Page ${index + 1} of ${pages.length}`;
      current.drawText(count, {
        x: PAGE.width - PAGE.margin - measure(count, normal, 9),
        y: 28,
        size: 9,
        font: normal,
        color: COLORS.ink,
      });
    });
    const bytes = await document.save({ useObjectStreams: false, addDefaultPage: false });
    if (bytes.length > MAX_BYTES)
      throw new DraftPdfRenderError('The generated draft exceeds the 10 MiB PDF limit.');
    return { bytes, pageCount: pages.length, templateVersion: 's19-english-a4-v1' as const };
  } catch (error) {
    if (error instanceof DraftPdfRenderError) throw error;
    throw new DraftPdfRenderError('The draft PDF could not be generated from the supplied data.');
  }
}