import { it, expect, vi, afterEach } from 'vitest';
import { exportRows } from '../src/services/exportService';
it('exports a real XLSX workbook with text cells and a usable dependency override', async () => {
  let saved: Blob | undefined;
  vi.stubGlobal('document', { createElement: () => ({ href: '', download: '', click: () => {} }) });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    saved = blob as Blob;
    return 'blob:test-export';
  });
  await exportRows([{ name: 'Student', registration: 'PL-123', note: '=1+1' }], 'test', 'xlsx');
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await saved!.arrayBuffer());
  expect(workbook.worksheets[0].getCell('A2').value).toBe('Student');
  expect(workbook.worksheets[0].getCell('C2').value).toBe('=1+1');
  expect(workbook.worksheets[0].getCell('C2').type).toBe(ExcelJS.ValueType.String);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
