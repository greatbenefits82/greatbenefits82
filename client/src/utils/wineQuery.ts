/**
 * Build the text used to fuzzy-match a vision-detected wine against the
 * existing master list. Prefer the model's raw label transcription (closer
 * to what's actually printed, including the small text that distinguishes
 * near-identical labels) and fall back to the structured fields only when
 * no raw text was returned.
 */
export function buildWineMatchQuery(wine: { rawLabelText?: string; brand: string; producer?: string; vintage?: string }): string {
  if (wine.rawLabelText?.trim()) return wine.rawLabelText.trim();
  return [wine.brand, wine.producer, wine.vintage].filter(Boolean).join(" ").trim();
}
