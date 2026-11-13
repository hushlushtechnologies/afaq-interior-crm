export const CSV_LIMITS = {
  bytes: 1024 * 1024,
  rows: 500,
  columns: 40,
  cellCharacters: 4000,
  headerCharacters: 160,
} as const;

export class LeadCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeadCsvError';
  }
}

export type LeadCsv = {
  headers: string[];
  rows: { rowNumber: number; cells: string[] }[];
  ignoredBlankRecords: number;
};

// Pure parsing only. No file storage, database access or spreadsheet execution.
export function parseLeadCsv(filename: string, bytes: Uint8Array): LeadCsv {
  if (
    !filename ||
    filename.length > 180 ||
    /[\\/\p{Cc}]/u.test(filename) ||
    !/^.+\.csv$/i.test(filename)
  ) {
    throw new LeadCsvError('Choose a CSV filename without a directory path.');
  }
  if (bytes.byteLength === 0 || bytes.byteLength > CSV_LIMITS.bytes) {
    throw new LeadCsvError('Choose a nonempty CSV file no larger than 1 MiB.');
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new LeadCsvError('Save the CSV using UTF-8 encoding.');
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    throw new LeadCsvError('The CSV contains unsupported control characters.');
  }
  const result: LeadCsv = { headers: [], rows: [], ignoredBlankRecords: 0 };
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;
  let recordNumber = 0;
  function finishCell() {
    cells.push(cell);
    if (cells.length > CSV_LIMITS.columns) {
      throw new LeadCsvError('The CSV exceeds 40 columns.');
    }
    cell = '';
    closedQuote = false;
  }
  function finishRecord() {
    finishCell();
    recordNumber += 1;
    if (recordNumber === 1) {
      const headers = cells.map((value) => value.trim());
      const identities = headers.map((value) => value.normalize('NFC').toLowerCase());
      if (
        headers.some((value) => !value || value.length > CSV_LIMITS.headerCharacters) ||
        new Set(identities).size !== headers.length
      ) {
        throw new LeadCsvError('Use nonempty, unique column headers of at most 160 characters.');
      }
      result.headers = headers;
    } else if (cells.length === 1 && cells[0] === '') {
      result.ignoredBlankRecords += 1;
    } else {
      if (result.rows.length >= CSV_LIMITS.rows) {
        throw new LeadCsvError('Split the CSV into files of at most 500 data rows.');
      }
      result.rows.push({ rowNumber: recordNumber, cells });
    }
    cells = [];
  }
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else cell += character;
    } else if (character === ',') {
      finishCell();
    } else if (character === '\r' || character === '\n') {
      finishRecord();
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else if (character === '"') {
      if (cell.length || closedQuote) {
        throw new LeadCsvError('A quote appears outside a quoted CSV field.');
      }
      quoted = true;
    } else {
      if (closedQuote) {
        throw new LeadCsvError('Unexpected text after a closing CSV quote.');
      }
      cell += character;
    }
    if (cell.length > CSV_LIMITS.cellCharacters) {
      throw new LeadCsvError('A CSV field exceeds 4000 characters.');
    }
  }
  if (quoted) throw new LeadCsvError('A quoted CSV field is not closed.');
  if (cell.length || cells.length || closedQuote) finishRecord();
  if (!result.headers.length || !result.rows.length) {
    throw new LeadCsvError('Include a header and at least one data row.');
  }
  return result;
}
