import { nanoid } from "nanoid";
import { db } from "../db.js";
import type { MasterItem } from "../types.js";

interface MasterRow {
  id: string;
  brand: string;
  producer: string | null;
  vintage: string | null;
  category: string | null;
  sku: string | null;
  quantity: number;
  location: string | null;
  notes: string | null;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
}

function rowToItem(row: MasterRow): MasterItem {
  return {
    id: row.id,
    brand: row.brand,
    producer: row.producer ?? undefined,
    vintage: row.vintage ?? undefined,
    category: row.category ?? undefined,
    sku: row.sku ?? undefined,
    quantity: row.quantity,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
    raw: row.raw_json ? JSON.parse(row.raw_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMasterItems(): MasterItem[] {
  const rows = db.prepare("SELECT * FROM master_items ORDER BY brand COLLATE NOCASE").all() as MasterRow[];
  return rows.map(rowToItem);
}

export function getMasterItem(id: string): MasterItem | undefined {
  const row = db.prepare("SELECT * FROM master_items WHERE id = ?").get(id) as MasterRow | undefined;
  return row ? rowToItem(row) : undefined;
}

export function findMasterByExactBrand(brand: string, vintage?: string): MasterItem | undefined {
  const row = db
    .prepare(
      "SELECT * FROM master_items WHERE lower(brand) = lower(?) AND (vintage IS ? OR lower(vintage) = lower(?)) LIMIT 1"
    )
    .get(brand, vintage ?? null, vintage ?? "") as MasterRow | undefined;
  return row ? rowToItem(row) : undefined;
}

export function insertMasterItem(draft: Omit<MasterItem, "id" | "createdAt" | "updatedAt">): MasterItem {
  const now = new Date().toISOString();
  const item: MasterItem = { ...draft, id: nanoid(), createdAt: now, updatedAt: now };
  db.prepare(
    `INSERT INTO master_items
      (id, brand, producer, vintage, category, sku, quantity, location, notes, raw_json, created_at, updated_at)
     VALUES (@id, @brand, @producer, @vintage, @category, @sku, @quantity, @location, @notes, @raw_json, @created_at, @updated_at)`
  ).run({
    id: item.id,
    brand: item.brand,
    producer: item.producer ?? null,
    vintage: item.vintage ?? null,
    category: item.category ?? null,
    sku: item.sku ?? null,
    quantity: item.quantity,
    location: item.location ?? null,
    notes: item.notes ?? null,
    raw_json: item.raw ? JSON.stringify(item.raw) : null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  });
  return item;
}

export function replaceAllMasterItems(items: Array<Omit<MasterItem, "id" | "createdAt" | "updatedAt">>): MasterItem[] {
  const insertMany = db.transaction((drafts: typeof items) => {
    db.prepare("DELETE FROM master_items").run();
    return drafts.map((draft) => insertMasterItem(draft));
  });
  return insertMany(items);
}

export function incrementMasterQuantity(id: string, delta: number): MasterItem | undefined {
  const now = new Date().toISOString();
  db.prepare("UPDATE master_items SET quantity = quantity + ?, updated_at = ? WHERE id = ?").run(delta, now, id);
  return getMasterItem(id);
}
