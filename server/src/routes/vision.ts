import { Router } from "express";
import {
  identifyGenericItems,
  identifyWineLabels,
  isVisionConfigured,
  type ImageInput,
} from "../services/visionRecognizer.js";

export const visionRouter = Router();

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/;

function parseDataUrl(dataUrl: unknown): ImageInput | undefined {
  if (typeof dataUrl !== "string") return undefined;
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return undefined;
  return { mediaType: match[1] as ImageInput["mediaType"], base64: match[2] };
}

visionRouter.post("/vision/identify", async (req, res) => {
  if (!isVisionConfigured()) {
    res.status(503).json({
      error:
        "画像認識AIが未設定です。サーバーの環境変数 ANTHROPIC_API_KEY を設定してから再起動してください。",
    });
    return;
  }

  const { mode, image } = req.body ?? {};
  const parsedImage = parseDataUrl(image);
  if (!parsedImage) {
    res.status(400).json({ error: "image は data:image/(jpeg|png|webp);base64,... 形式で送ってください" });
    return;
  }
  if (mode !== "generic" && mode !== "wine") {
    res.status(400).json({ error: "mode は 'generic' か 'wine' を指定してください" });
    return;
  }

  try {
    if (mode === "generic") {
      const result = await identifyGenericItems(parsedImage);
      res.json(result);
    } else {
      const result = await identifyWineLabels(parsedImage);
      res.json(result);
    }
  } catch (err) {
    res.status(502).json({ error: `画像認識に失敗しました: ${(err as Error).message}` });
  }
});
