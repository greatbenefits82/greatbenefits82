/** Column roles we try to recognize in an imported inventory spreadsheet. */
export type ColumnRole =
  | "brand"
  | "producer"
  | "vintage"
  | "category"
  | "sku"
  | "quantity"
  | "location"
  | "notes";

export interface DetectedFormat {
  /** true when an existing spreadsheet's columns matched a known inventory layout */
  isExistingFormat: boolean;
  /** original header row, in original order */
  headers: string[];
  /** header -> role, only for headers we could interpret */
  roleByHeader: Record<string, ColumnRole>;
  /** human-readable note about what was detected/created */
  note: string;
}

export interface MasterItem {
  id: string;
  brand: string;
  producer?: string;
  vintage?: string;
  category?: string;
  sku?: string;
  quantity: number;
  location?: string;
  notes?: string;
  /** original spreadsheet row values keyed by original header, preserved for faithful export */
  raw?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export type CountMode = "generic" | "wine";

export interface CountRecord {
  id: string;
  timestamp: string;
  mode: CountMode;
  /** what was recognized: coco-ssd class name for generic mode, OCR text / brand for wine mode */
  label: string;
  quantity: number;
  matchedMasterId?: string;
  matchedBrand?: string;
  matchScore?: number;
  ocrText?: string;
  location?: string;
  note?: string;
}

export interface WineCandidate {
  masterId: string;
  brand: string;
  producer?: string;
  vintage?: string;
  score: number; // 0 (best) .. 1 (worst), Fuse.js convention
}

export interface WineLookupResult {
  title: string;
  snippet?: string;
  source: string;
  url?: string;
}
