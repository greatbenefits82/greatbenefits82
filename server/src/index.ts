import express from "express";
import cors from "cors";
import { masterRouter } from "./routes/master.js";
import { recordsRouter } from "./routes/records.js";
import { wineRouter } from "./routes/wine.js";
import { exportRouter } from "./routes/export.js";
import { visionRouter } from "./routes/vision.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", masterRouter);
app.use("/api", recordsRouter);
app.use("/api", wineRouter);
app.use("/api", exportRouter);
app.use("/api", visionRouter);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Inventory count server listening on http://localhost:${port}`);
});
