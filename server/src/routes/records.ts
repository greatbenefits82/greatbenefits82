import { Router } from "express";
import { insertCountRecord, listCountRecords } from "../services/countRepo.js";

export const recordsRouter = Router();

recordsRouter.get("/records", (_req, res) => {
  res.json({ records: listCountRecords() });
});

/** Log a generic (non-wine) real-time detection count, e.g. from the coco-ssd overlay. */
recordsRouter.post("/records", (req, res) => {
  const { label, quantity, location, note } = req.body ?? {};
  if (!label || typeof label !== "string") {
    res.status(400).json({ error: "label is required" });
    return;
  }
  if (!Number.isFinite(quantity)) {
    res.status(400).json({ error: "quantity must be a number" });
    return;
  }
  const record = insertCountRecord({ mode: "generic", label, quantity: Number(quantity), location, note });
  res.status(201).json({ record });
});
