import Fuse from "fuse.js";
import type { MasterItem, WineCandidate } from "../types.js";

/**
 * Wine labels can look nearly identical (same producer, same design) while
 * differing in a small detail like the vintage year or a cuvée name printed
 * in small text. Plain fuzzy text similarity alone is not safe here, so we
 * fuzzy-match on the full label text but then re-rank: a detected year
 * mismatch between the OCR text and a candidate's vintage is penalized
 * heavily, since that is exactly the kind of "looks the same, is actually
 * different" case the client explicitly warned about.
 */

function extractYear(text: string): string | undefined {
  const m = text.match(/(19|20)\d{2}/);
  return m?.[0];
}

/** Fuse.js score convention: 0 = perfect match, 1 = no match. */
export const HIGH_CONFIDENCE_THRESHOLD = 0.3;

export function matchWine(ocrText: string, masterList: MasterItem[], limit = 5): WineCandidate[] {
  const query = ocrText.trim();
  if (masterList.length === 0 || !query) return [];

  const searchable = masterList.map((item) => ({
    item,
    composite: [item.brand, item.producer, item.vintage].filter(Boolean).join(" "),
  }));

  const fuse = new Fuse(searchable, {
    keys: ["composite"],
    includeScore: true,
    threshold: 0.6,
    ignoreLocation: true,
  });

  const queryYear = extractYear(query);
  const results = fuse.search(query, { limit: Math.max(limit * 3, 10) });

  const rescored = results.map((r) => {
    let score = r.score ?? 1;
    const candidateYear = r.item.item.vintage ? extractYear(r.item.item.vintage) : undefined;
    if (queryYear && candidateYear) {
      score = queryYear === candidateYear ? Math.max(0, score - 0.1) : Math.min(1, score + 0.35);
    }
    return { item: r.item.item, score };
  });

  rescored.sort((a, b) => a.score - b.score);

  return rescored.slice(0, limit).map(({ item, score }) => ({
    masterId: item.id,
    brand: item.brand,
    producer: item.producer,
    vintage: item.vintage,
    score,
  }));
}
