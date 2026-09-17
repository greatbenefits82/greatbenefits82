import { nanoid } from "nanoid";
import { db } from "../db.js";
import type { CountRecord } from "../types.js";

interface CountRow {
  id: string;
  timestamp: string;
  mode: string;
  label: string;
  quantity: number;
  matched_master_id: string | null;
  matched_brand: string | null;
  match_score: number | null;
  ocr_text: string | null;
  location: string | null;
  note: string | null;
}

function rowToRecord(row: CountRow): CountRecord {
  return {
    id: row.id,
    timestamp: row.timestamp,
    mode: row.mode as CountRecord["mode"],
    label: row.label,
    quantity: row.quantity,
    matchedMasterId: row.matched_master_id ?? undefined,
    matchedBrand: row.matched_brand ?? undefined,
    matchScore: row.match_score ?? undefined,
    ocrText: row.ocr_text ?? undefined,
    location: row.location ?? undefined,
    note: row.note ?? undefined,
  };
}

export function listCountRecords(): CountRecord[] {
  const rows = db.prepare("SELECT * FROM count_records ORDER BY timestamp DESC").all() as CountRow[];
  return rows.map(rowToRecord);
}

export function insertCountRecord(draft: Omit<CountRecord, "id" | "timestamp"> & { timestamp?: string }): CountRecord {
  const record: CountRecord = {
    ...draft,
    id: nanoid(),
    timestamp: draft.timestamp ?? new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO count_records
      (id, timestamp, mode, label, quantity, matched_master_id, matched_brand, match_score, ocr_text, location, note)
     VALUES (@id, @timestamp, @mode, @label, @quantity, @matched_master_id, @matched_brand, @match_score, @ocr_text, @location, @note)`
  ).run({
    id: record.id,
    timestamp: record.timestamp,
    mode: record.mode,
    label: record.label,
    quantity: record.quantity,
    matched_master_id: record.matchedMasterId ?? null,
    matched_brand: record.matchedBrand ?? null,
    match_score: record.matchScore ?? null,
    ocr_text: record.ocrText ?? null,
    location: record.location ?? null,
    note: record.note ?? null,
  });
  return record;
}

export function clearCountRecords(): void {
  db.prepare("DELETE FROM count_records").run();
}
