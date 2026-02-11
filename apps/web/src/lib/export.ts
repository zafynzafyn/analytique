import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'json' | 'xlsx';

export function exportData(
  data: Record<string, unknown>[],
  filename: string,
  format: ExportFormat
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const fullFilename = `${filename}_${timestamp}`;

  switch (format) {
    case 'csv':
      exportCSV(data, fullFilename);
      break;
    case 'json':
      exportJSON(data, fullFilename);
      break;
    case 'xlsx':
      exportExcel(data, fullFilename);
      break;
  }
}

function exportCSV(data: Record<string, unknown>[], filename: string): void {
  const columns = Object.keys(data[0]);

  // Create header row
  const header = columns.map(escapeCSVValue).join(',');

  // Create data rows
  const rows = data.map((row) =>
    columns.map((col) => escapeCSVValue(row[col])).join(',')
  );

  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${filename}.csv`);
}

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = typeof value === 'object'
    ? JSON.stringify(value)
    : String(value);

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function exportJSON(data: Record<string, unknown>[], filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  saveAs(blob, `${filename}.json`);
}

function exportExcel(data: Record<string, unknown>[], filename: string): void {
  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const columns = Object.keys(data[0]);
  const colWidths = columns.map((col) => {
    const maxLength = Math.max(
      col.length,
      ...data.map((row) => {
        const value = row[col];
        if (value === null || value === undefined) return 0;
        return String(value).length;
      })
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  worksheet['!cols'] = colWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  // Generate and save file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
}
