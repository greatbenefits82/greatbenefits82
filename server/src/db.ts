import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.INVENTORY_DB_PATH ?? path.join(dataDir, "inventory.sqlite");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS master_items (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    producer TEXT,
    vintage TEXT,
    category TEXT,
    sku TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    location TEXT,
    notes TEXT,
    raw_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS count_records (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    mode TEXT NOT NULL,
    label TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    matched_master_id TEXT,
    matched_brand TEXT,
    match_score REAL,
    ocr_text TEXT,
    location TEXT,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS format_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    is_existing_format INTEGER NOT NULL,
    headers_json TEXT NOT NULL,
    role_map_json TEXT NOT NULL,
    note TEXT NOT NULL
  );
`);
