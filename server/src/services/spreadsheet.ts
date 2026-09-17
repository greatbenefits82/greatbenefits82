import ExcelJS from "exceljs";
import { Readable } from "node:stream";

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray((value as ExcelJS.CellRichTextValue).richText)) {
      return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    }
    if ("text" in value) return String((value as { text: unknown }).text);
    if ("result" in value) return String((value as { result: unknown }).result ?? "");
    return String(value);
  }
  return String(value);
}

/** Read the first worksheet of an uploaded .xlsx or .csv file into a 2D array of strings. */
export async function readRowsFromBuffer(buffer: Buffer, filename: string): Promise<string[][]> {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  const workbook = new ExcelJS.Workbook();
  let worksheet: ExcelJS.Worksheet | undefined;

  if (isCsv) {
    worksheet = await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    worksheet = workbook.worksheets[0];
  }
  if (!worksheet) return [];

  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    // ExcelJS row.values is 1-indexed with index 0 unused
    const values = (row.values as ExcelJS.CellValue[]).slice(1);
    rows.push(values.map(cellToString));
  });
  return rows;
}

export async function writeRowsToXlsxBuffer(sheetName: string, rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRows(rows);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
