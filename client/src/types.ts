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
  isExistingFormat: boolean;
  headers: string[];
  roleByHeader: Record<string, ColumnRole>;
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
  createdAt: string;
  updatedAt: string;
}

export interface WineCandidate {
  masterId: string;
  brand: string;
  producer?: string;
  vintage?: string;
  score: number;
}

export interface WineLookupResult {
  title: string;
  snippet?: string;
  source: string;
  url?: string;
}

export interface CountRecord {
  id: string;
  timestamp: string;
  mode: "generic" | "wine";
  label: string;
  quantity: number;
  matchedMasterId?: string;
  matchedBrand?: string;
  matchScore?: number;
  ocrText?: string;
  location?: string;
  note?: string;
}

export interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}
