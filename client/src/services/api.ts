import type { CountRecord, DetectedFormat, MasterItem, WineCandidate, WineLookupResult } from "../types";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getFormat(): Promise<{ format: DetectedFormat }> {
  return request("/format");
}

export function importSpreadsheet(file: File): Promise<{ format: DetectedFormat; importedCount: number }> {
  const form = new FormData();
  form.append("file", file);
  return request("/import", { method: "POST", body: form });
}

export function listMaster(): Promise<{ items: MasterItem[] }> {
  return request("/master");
}

export function addMasterItem(item: Partial<MasterItem>): Promise<{ item: MasterItem }> {
  return request("/master", { method: "POST", body: JSON.stringify(item) });
}

export function matchWine(ocrText: string): Promise<{ candidates: WineCandidate[]; highConfidenceThreshold: number }> {
  return request("/wine/match", { method: "POST", body: JSON.stringify({ ocrText }) });
}

export function lookupWineOnline(
  query: string
): Promise<{ provider: string; configured: boolean; results: WineLookupResult[] }> {
  return request("/wine/lookup", { method: "POST", body: JSON.stringify({ query }) });
}

export interface ConfirmWinePayload {
  masterId?: string;
  brand?: string;
  producer?: string;
  vintage?: string;
  category?: string;
  location?: string;
  note?: string;
  quantity: number;
  ocrText?: string;
  matchScore?: number;
}

export function confirmWine(payload: ConfirmWinePayload): Promise<{ master: MasterItem; record: CountRecord }> {
  return request("/wine/confirm", { method: "POST", body: JSON.stringify(payload) });
}

export function listRecords(): Promise<{ records: CountRecord[] }> {
  return request("/records");
}

export function addGenericRecord(payload: {
  label: string;
  quantity: number;
  location?: string;
  note?: string;
}): Promise<{ record: CountRecord }> {
  return request("/records", { method: "POST", body: JSON.stringify(payload) });
}

export function exportUrl(): string {
  return `${BASE}/export`;
}
