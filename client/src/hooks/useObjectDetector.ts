import { useEffect, useRef, useState } from "react";
import "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import type { DetectedObject } from "../types";

/**
 * Loads the COCO-SSD model once (cached by the browser/PWA after first
 * download) and exposes a `detect` function that runs entirely on-device.
 * This is what powers the generic real-time "what and how many" overlay —
 * it recognizes everyday object classes (bottle, cup, book, box, ...) but
 * not specific brands, which is why wine identification uses a separate
 * capture + OCR + matching flow instead.
 */
export function useObjectDetector() {
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cocoSsd
      .load({ base: "lite_mobilenet_v2" })
      .then((model) => {
        if (cancelled) return;
        modelRef.current = model;
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function detect(source: HTMLVideoElement, minScore = 0.5): Promise<DetectedObject[]> {
    const model = modelRef.current;
    if (!model) return [];
    const predictions = await model.detect(source);
    return predictions
      .filter((p) => p.score >= minScore)
      .map((p) => ({ class: p.class, score: p.score, bbox: p.bbox as [number, number, number, number] }));
  }

  return { ready, error, detect };
}
