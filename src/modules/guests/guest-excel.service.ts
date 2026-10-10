import ExcelJS from 'exceljs';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';

export const MAX_IMPORT_ROWS = 2000;

export interface ParsedGuest {
  row: number;
  name: string;
  email: string;
  phone: string | null;
}

export interface ImportRowError {
  row: number;
  reason: string;
}

const HEADER_ALIASES: Record<'name' | 'email' | 'phone', string[]> = {
  name: ['name', 'guest name', 'full name', 'guest'],
  email: ['email', 'e-mail', 'email address', 'e-mail address'],
  phone: ['phone', 'mobile', 'phone number', 'mobile number', 'contact', 'contact number'],
};

const emailValidator = z.email();

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Reads the first worksheet of an .xlsx file. Row 1 must contain the headers
 * "Name" and "Email" ("Phone" is optional); column order does not matter.
 */
export async function parseGuestWorkbook(
  buffer: Buffer,
): Promise<{ guests: ParsedGuest[]; errors: ImportRowError[]; totalRows: number }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw AppError.badRequest(
      'The file could not be read. Please upload a valid .xlsx file.',
      'INVALID_EXCEL',
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw AppError.badRequest('The Excel file has no worksheets', 'INVALID_EXCEL');

  const columns: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normaliseHeader(cell.text ?? '');
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      const field = key as keyof typeof HEADER_ALIASES;
      if (columns[field] === undefined && aliases.includes(header)) columns[field] = columnNumber;
    }
  });

  if (columns.name === undefined || columns.email === undefined) {
    throw AppError.badRequest(
      'The first row must contain "Name" and "Email" column headers. Download the sample file for the correct format.',
      'INVALID_EXCEL_HEADERS',
    );
  }

  const guests: ParsedGuest[] = [];
  const errors: ImportRowError[] = [];
  const seenEmails = new Map<string, number>();
  let totalRows = 0;

  const cellText = (row: ExcelJS.Row, column: number | undefined) =>
    column === undefined ? '' : (row.getCell(column).text ?? '').trim();

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const name = cellText(row, columns.name).replace(/\s+/g, ' ');
    const email = cellText(row, columns.email).toLowerCase();
    const phone = cellText(row, columns.phone);
    if (!name && !email && !phone) continue; // blank line

    totalRows += 1;
    if (totalRows > MAX_IMPORT_ROWS) {
      throw AppError.badRequest(
        `A file can contain at most ${MAX_IMPORT_ROWS} guests`,
        'TOO_MANY_ROWS',
      );
    }

    if (!name) {
      errors.push({ row: rowNumber, reason: 'Name is empty' });
      continue;
    }
    if (name.length > 150) {
      errors.push({ row: rowNumber, reason: 'Name is longer than 150 characters' });
      continue;
    }
    if (!email || !emailValidator.safeParse(email).success || email.length > 255) {
      errors.push({ row: rowNumber, reason: `Invalid e-mail "${email}"` });
      continue;
    }
    if (phone.length > 30) {
      errors.push({ row: rowNumber, reason: 'Phone number is too long' });
      continue;
    }
    const firstRow = seenEmails.get(email);
    if (firstRow !== undefined) {
      errors.push({ row: rowNumber, reason: `Duplicate of row ${firstRow} (${email})` });
      continue;
    }

    seenEmails.set(email, rowNumber);
    guests.push({ row: rowNumber, name, email, phone: phone || null });
  }

  return { guests, errors, totalRows };
}

/** The downloadable template customers fill in. */
export async function buildSampleGuestWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Wedding Invitations';

  const sheet = workbook.addWorksheet('Guests');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Email', key: 'email', width: 36 },
    { header: 'Phone', key: 'phone', width: 18 },
  ];
  sheet.addRows([
    { name: 'Nimal Perera', email: 'nimal.perera@example.com', phone: '+94 77 123 4567' },
    { name: 'Kamala Silva', email: 'kamala.silva@example.com', phone: '0712345678' },
  ]);
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB08D57' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const help = workbook.addWorksheet('Instructions');
  help.columns = [{ width: 100 }];
  [
    'How to fill in the guest list',
    '1. Use the "Guests" sheet. Keep the header row (Name, Email, Phone) as it is.',
    '2. One guest per row. Name and Email are required; Phone is optional.',
    '3. Replace the two example rows with your own guests.',
    `4. Up to ${MAX_IMPORT_ROWS} guests per file. Duplicate e-mails are skipped.`,
    '5. Save as .xlsx and upload it from your dashboard.',
  ].forEach((line, index) => {
    const row = help.addRow([line]);
    if (index === 0) row.font = { bold: true, size: 13 };
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
