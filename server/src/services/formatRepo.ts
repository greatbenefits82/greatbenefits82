import { db } from "../db.js";
import type { DetectedFormat } from "../types.js";
import { defaultFormat } from "./formatDetector.js";

interface FormatRow {
  is_existing_format: number;
  headers_json: string;
  role_map_json: string;
  note: string;
}

export function saveFormatState(format: DetectedFormat): void {
  db.prepare(
    `INSERT INTO format_state (id, is_existing_format, headers_json, role_map_json, note)
     VALUES (1, @is_existing_format, @headers_json, @role_map_json, @note)
     ON CONFLICT(id) DO UPDATE SET
       is_existing_format = excluded.is_existing_format,
       headers_json = excluded.headers_json,
       role_map_json = excluded.role_map_json,
       note = excluded.note`
  ).run({
    is_existing_format: format.isExistingFormat ? 1 : 0,
    headers_json: JSON.stringify(format.headers),
    role_map_json: JSON.stringify(format.roleByHeader),
    note: format.note,
  });
}

export function loadFormatState(): DetectedFormat {
  const row = db.prepare("SELECT * FROM format_state WHERE id = 1").get() as FormatRow | undefined;
  if (!row) return defaultFormat();
  return {
    isExistingFormat: Boolean(row.is_existing_format),
    headers: JSON.parse(row.headers_json),
    roleByHeader: JSON.parse(row.role_map_json),
    note: row.note,
  };
}
