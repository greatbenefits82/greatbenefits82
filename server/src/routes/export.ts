import { Router } from "express";
import { loadFormatState } from "../services/formatRepo.js";
import { listMasterItems } from "../services/masterRepo.js";
import { writeRowsToXlsxBuffer } from "../services/spreadsheet.js";
import type { ColumnRole, MasterItem } from "../types.js";

export const exportRouter = Router();

function fieldForRole(item: MasterItem, role: ColumnRole): string {
  switch (role) {
    case "brand":
      return item.brand;
    case "producer":
      return item.producer ?? "";
    case "vintage":
      return item.vintage ?? "";
    case "category":
      return item.category ?? "";
    case "sku":
      return item.sku ?? "";
    case "quantity":
      return String(item.quantity);
    case "location":
      return item.location ?? "";
    case "notes":
      return item.notes ?? "";
    default:
      return "";
  }
}

/**
 * Export the current inventory. If a matching existing spreadsheet was
 * imported earlier, the export reuses its exact header layout (and any
 * original columns we didn't need to touch, via each item's preserved raw
 * row) so it drops back into the user's existing workflow. Otherwise it
 * uses the original format created for this app.
 */
exportRouter.get("/export", async (_req, res) => {
  const format = loadFormatState();
  const items = listMasterItems();

  const rows = items.map((item) => {
    if (format.isExistingFormat && item.raw) {
      const row = { ...item.raw };
      // keep the raw row's other original columns intact, but refresh the quantity cell with our current count
      const quantityHeader = Object.entries(format.roleByHeader).find(([, r]) => r === "quantity")?.[0];
      if (quantityHeader) row[quantityHeader] = String(item.quantity);
      return format.headers.map((h) => row[h] ?? "");
    }
    return format.headers.map((h) => fieldForRole(item, format.roleByHeader[h]));
  });

  const sheetData = [format.headers, ...rows];
  const buffer = await writeRowsToXlsxBuffer("棚卸し", sheetData);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=inventory_export.xlsx");
  res.send(buffer);
});
