import { Router } from "express";
import multer from "multer";
import { detectFormat, rowsToMasterItems } from "../services/formatDetector.js";
import { insertMasterItem, listMasterItems, replaceAllMasterItems } from "../services/masterRepo.js";
import { loadFormatState, saveFormatState } from "../services/formatRepo.js";
import { readRowsFromBuffer } from "../services/spreadsheet.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const masterRouter = Router();

masterRouter.get("/master", (_req, res) => {
  res.json({ items: listMasterItems() });
});

masterRouter.post("/master", (req, res) => {
  const { brand, producer, vintage, category, sku, quantity, location, notes } = req.body ?? {};
  if (!brand || typeof brand !== "string") {
    res.status(400).json({ error: "brand is required" });
    return;
  }
  const item = insertMasterItem({
    brand,
    producer,
    vintage,
    category,
    sku,
    quantity: Number.isFinite(quantity) ? Number(quantity) : 0,
    location,
    notes,
  });
  res.status(201).json({ item });
});

masterRouter.get("/format", (_req, res) => {
  res.json({ format: loadFormatState() });
});

/**
 * Import an existing inventory / wine-list spreadsheet (.xlsx/.csv). We
 * detect whether its columns match a known layout; if so we adopt it as the
 * format going forward (so exports stay compatible with what the user
 * already had). Otherwise we fall back to an original format and report
 * that no existing layout was recognized, rather than guessing.
 */
masterRouter.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "file is required (multipart field 'file')" });
    return;
  }

  let rows: string[][];
  try {
    rows = await readRowsFromBuffer(req.file.buffer, req.file.originalname);
  } catch {
    res.status(400).json({ error: "could not parse uploaded file as a spreadsheet" });
    return;
  }
  if (rows.length === 0) {
    res.status(400).json({ error: "uploaded spreadsheet is empty" });
    return;
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => String(h ?? "").trim()).filter((h) => h !== "");
  const format = detectFormat(headers);
  saveFormatState(format);

  let importedCount = 0;
  if (format.isExistingFormat) {
    const drafts = rowsToMasterItems(headers, dataRows, format.roleByHeader);
    replaceAllMasterItems(drafts);
    importedCount = drafts.length;
  }

  res.json({ format, importedCount });
});
