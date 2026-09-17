import { useCallback, useEffect, useRef, useState } from "react";
import { createWorker, type Worker } from "tesseract.js";

/**
 * On-device OCR for reading the small printed text on a wine label (brand,
 * producer, vintage) — this is what lets the app tell two similar-looking
 * bottles apart instead of just saying "a bottle". Loads English + Japanese
 * trained data; most European wine labels are Latin-script enough for the
 * English model to extract usable brand/vintage text even when not perfect.
 */
export function useOCR() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createWorker("eng+jpn", 1, {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract/tesseract-core-simd-lstm.js",
      workerBlobURL: false,
    })
      .then((worker) => {
        if (cancelled) {
          worker.terminate();
          return;
        }
        workerRef.current = worker;
        setReady(true);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const recognize = useCallback(async (image: string | HTMLCanvasElement): Promise<string> => {
    const worker = workerRef.current;
    if (!worker) throw new Error("OCRエンジンがまだ準備できていません");
    const {
      data: { text },
    } = await worker.recognize(image);
    return text.trim();
  }, []);

  return { ready, error, recognize };
}
