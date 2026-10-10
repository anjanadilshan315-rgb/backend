import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseGuestWorkbook } from '../src/modules/guests/guest-excel.service.js';
import { AppError } from '../src/common/errors/app-error.js';

async function workbook(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Guests');
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parseGuestWorkbook', () => {
  it('accepts header aliases in any column order and reports bad rows', async () => {
    const buffer = await workbook([
      ['Mobile', 'E-mail', 'Guest Name'],
      ['0771234567', 'A@Example.com', 'Amal'],
      ['', 'bad-email', 'Bimal'],
      ['', 'c@example.com', ''],
      ['', '', ''], // blank line is ignored
      ['', 'a@example.com', 'Amal again'],
      ['', 'd@example.com', '  Dilani   Perera '],
    ]);

    const result = await parseGuestWorkbook(buffer);

    expect(result.totalRows).toBe(5);
    expect(result.guests).toEqual([
      { row: 2, name: 'Amal', email: 'a@example.com', phone: '0771234567' },
      { row: 7, name: 'Dilani Perera', email: 'd@example.com', phone: null },
    ]);
    expect(result.errors.map((e) => e.row)).toEqual([3, 4, 6]);
    expect(result.errors[2]?.reason).toContain('Duplicate of row 2');
  });

  it('reads e-mail cells that Excel turned into hyperlinks', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Guests');
    sheet.addRow(['Name', 'Email']);
    sheet.addRow(['Nimal', { text: 'nimal@example.com', hyperlink: 'mailto:nimal@example.com' }]);
    const result = await parseGuestWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(result.guests[0]?.email).toBe('nimal@example.com');
  });

  it('rejects files without the required headers', async () => {
    const buffer = await workbook([
      ['Full name', 'Phone'],
      ['Amal', '077'],
    ]);
    await expect(parseGuestWorkbook(buffer)).rejects.toMatchObject({
      code: 'INVALID_EXCEL_HEADERS',
    });
  });

  it('rejects files that are not Excel', async () => {
    await expect(parseGuestWorkbook(Buffer.from('not a zip'))).rejects.toBeInstanceOf(AppError);
  });
});
