import { parseLeadCsv } from './csv';
import { importErrorFieldSchema, importUploadSchema } from './contracts';
import { previewLeadImport } from './preview';

// Rebuild the payload from original bytes; never accept a browser's parsed rows.
export async function prepareLeadImport(input: unknown, bytes: Uint8Array) {
  const metadata = importUploadSchema.parse(input);
  const csv = parseLeadCsv(metadata.filename, bytes);
  const preview = previewLeadImport(csv, metadataWithoutUploadFields(metadata));
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  const fileHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return {
    requestId: metadata.requestId,
    payload: {
      filename: metadata.filename,
      fileHash,
      sourceCode: metadata.sourceCode,
      assignedUserId: metadata.assignedUserId,
      defaultInquiryOn: metadata.defaultInquiryOn,
      mapping: metadata.mapping,
      columnCount: csv.headers.length,
      rows: preview.rows.map((row) => ({
        rowNumber: row.rowNumber,
        data: row.data,
        errors: [...new Set(row.errors.map((error) => importErrorFieldSchema.parse(error.field)))],
      })),
    },
  };
}

function metadataWithoutUploadFields(value: ReturnType<typeof importUploadSchema.parse>) {
  return {
    mapping: value.mapping,
    sourceCode: value.sourceCode,
    assignedUserId: value.assignedUserId,
    defaultInquiryOn: value.defaultInquiryOn,
  };
}
