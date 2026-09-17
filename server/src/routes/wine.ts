import { Router } from "express";
import { HIGH_CONFIDENCE_THRESHOLD, matchWine } from "../services/wineMatcher.js";
import { getWineLookupProvider } from "../services/wineLookup.js";
import { listMasterItems, incrementMasterQuantity, insertMasterItem } from "../services/masterRepo.js";
import { insertCountRecord } from "../services/countRepo.js";
import { loadFormatState, saveFormatState } from "../services/formatRepo.js";
import { defaultFormat } from "../services/formatDetector.js";

export const wineRouter = Router();

/**
 * Match OCR'd label text against the existing wine master list. Returns
 * ranked candidates; the client should present these for human confirmation
 * rather than auto-committing, since near-identical labels can differ only
 * in small printed text (vintage, cuvée) that OCR can mangle.
 */
wineRouter.post("/wine/match", (req, res) => {
  const { ocrText } = req.body ?? {};
  if (!ocrText || typeof ocrText !== "string") {
    res.status(400).json({ error: "ocrText is required" });
    return;
  }
  const candidates = matchWine(ocrText, listMasterItems());
  res.json({ candidates, highConfidenceThreshold: HIGH_CONFIDENCE_THRESHOLD });
});

/** Look up a wine online when it isn't found in the existing master list. */
wineRouter.post("/wine/lookup", async (req, res) => {
  const { query } = req.body ?? {};
  if (!query || typeof query !== "string") {
    res.status(400).json({ error: "query is required" });
    return;
  }
  const provider = getWineLookupProvider();
  try {
    const results = await provider.search(query);
    res.json({ provider: provider.name, configured: provider.isConfigured(), results });
  } catch (err) {
    res.status(502).json({ error: `online lookup failed: ${(err as Error).message}` });
  }
});

/**
 * Record a wine count. Either against an existing master item (masterId
 * given -> quantity incremented) or as a brand-new entry when it wasn't in
 * the existing sheet (brand given -> new master row created, using the
 * existing format if one was imported, otherwise the original format).
 */
wineRouter.post("/wine/confirm", (req, res) => {
  const { masterId, brand, producer, vintage, category, location, note, quantity, ocrText, matchScore } =
    req.body ?? {};

  const qty = Number.isFinite(quantity) ? Number(quantity) : 1;

  if (masterId && typeof masterId === "string") {
    const updated = incrementMasterQuantity(masterId, qty);
    if (!updated) {
      res.status(404).json({ error: "masterId not found" });
      return;
    }
    const record = insertCountRecord({
      mode: "wine",
      label: updated.brand,
      quantity: qty,
      matchedMasterId: updated.id,
      matchedBrand: updated.brand,
      matchScore: Number.isFinite(matchScore) ? Number(matchScore) : undefined,
      ocrText,
      location,
      note,
    });
    res.status(201).json({ master: updated, record });
    return;
  }

  if (!brand || typeof brand !== "string") {
    res.status(400).json({ error: "either masterId or brand is required" });
    return;
  }

  // First wine ever recorded without an imported sheet: establish the original format.
  const format = loadFormatState();
  if (!format.headers.length) {
    saveFormatState(defaultFormat());
  }

  const created = insertMasterItem({ brand, producer, vintage, category, quantity: qty, location, notes: note });
  const record = insertCountRecord({
    mode: "wine",
    label: created.brand,
    quantity: qty,
    matchedMasterId: created.id,
    matchedBrand: created.brand,
    ocrText,
    location,
    note: note ?? "既存棚卸し表に無かった新規銘柄",
  });
  res.status(201).json({ master: created, record });
});
