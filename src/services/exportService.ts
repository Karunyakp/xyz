import { csvCell } from '../domain/models';
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportRows(
  records: Record<string, unknown>[],
  name: string,
  format: 'csv' | 'xlsx' = 'csv',
) {
  const keys = Object.keys(records[0] || {});
  if (!keys.length) throw new Error('No records to export');
  if (format === 'csv') {
    download(
      new Blob(
        [
          '\ufeff' +
            [
              keys.map(csvCell).join(','),
              ...records.map((r) =>
                keys
                  .map((k) => csvCell(typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]))
                  .join(','),
              ),
            ].join('\r\n'),
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
      name + '.csv',
    );
    return;
  }
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('PLANORA');
  sheet.columns = keys.map((key) => ({ header: key, key, width: 24 }));
  records.forEach((r) =>
    sheet.addRow(
      Object.fromEntries(
        keys.map((k) => [k, typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]]),
      ),
    ),
  );
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17453B' } };
  download(
    new Blob([await workbook.xlsx.writeBuffer()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    name + '.xlsx',
  );
}
export async function importSheet(file: File): Promise<Record<string, string>[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Import limit: 5 MB');
  const ExcelJS = await import('exceljs');
  const w = new ExcelJS.Workbook();
  let data: string[][] = [];
  if (file.name.endsWith('.xlsx')) {
    await w.xlsx.load(await file.arrayBuffer());
    const sheet = w.worksheets[0];
    sheet.eachRow((row) =>
      data.push((row.values as unknown[]).slice(1).map((v) => String(v ?? ''))),
    );
  } else {
    const text = await file.text();
    const lines = text
      .replace(/^\ufeff/, '')
      .trim()
      .split(/\r?\n/);
    data = lines.map((line) => {
      const out: string[] = [];
      let quoted = false,
        cell = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (quoted && line[i + 1] === '"') {
            cell += '"';
            i++;
          } else quoted = !quoted;
        } else if (c === ',' && !quoted) {
          out.push(cell);
          cell = '';
        } else cell += c;
      }
      if (quoted) throw new Error('CSV fields with embedded newlines are not supported; use XLSX');
      out.push(cell);
      return out;
    });
  }
  const [headers, ...records] = data;
  if (!headers?.includes('email')) throw new Error('Include an email column');
  if (records.length > 200) throw new Error('Import at most 200 invitations per batch');
  return records.map((r) => Object.fromEntries(headers.map((k, i) => [k, r[i] || ''])));
}
export function eventCalendar(event: {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  contact: string;
}) {
  const fmt = (v: string) =>
    new Date(v)
      .toISOString()
      .replaceAll(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const esc = (v: string) =>
    v
      .replaceAll('\\', '\\\\')
      .replaceAll('\n', '\\n')
      .replaceAll(',', '\\,')
      .replaceAll(';', '\\;')
      .replaceAll('\r', '');
  download(
    new Blob(
      [
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//PLANORA//Events//EN',
          'BEGIN:VEVENT',
          'UID:' + event.id + '@planora',
          'DTSTAMP:' + fmt(new Date().toISOString()),
          'DTSTART:' + fmt(event.starts_at),
          'DTEND:' + fmt(event.ends_at),
          'SUMMARY:' + esc(event.title),
          'DESCRIPTION:' + esc(event.description),
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\r\n'),
      ],
      { type: 'text/calendar' },
    ),
    'planora-event.ics',
  );
}
export async function certificatePdf(
  c: { recipient_name: string; event_title: string; verification_code: string; issued_at: string },
  institution: string,
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFillColor('#f8f8f2');
  doc.rect(0, 0, 297, 210, 'F');
  doc.setDrawColor('#17453b');
  doc.rect(12, 12, 273, 186);
  doc.setTextColor('#17453b');
  doc.setFontSize(16);
  doc.text('PLANORA', 25, 32);
  doc.setFontSize(12);
  doc.text(institution, 272, 32, { align: 'right' });
  doc.setFontSize(32);
  doc.text('Certificate of participation', 148, 74, { align: 'center' });
  doc.setFontSize(12);
  doc.text('This recognises the participation of', 148, 96, { align: 'center' });
  doc.setFontSize(26);
  doc.text(doc.splitTextToSize(c.recipient_name, 240), 148, 116, { align: 'center' });
  doc.setFontSize(14);
  doc.text(doc.splitTextToSize(c.event_title, 240), 148, 141, { align: 'center' });
  doc.setFontSize(9);
  doc.text('Issued ' + new Date(c.issued_at).toLocaleDateString(), 25, 176);
  const url = window.location.origin + '/verify/' + c.verification_code;
  doc.textWithLink('Verify this certificate', 222, 176, { url });
  doc.setFontSize(8);
  doc.text(c.verification_code, 25, 185);
  doc.save('PLANORA-Certificate.pdf');
}
