import { useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { useObjectDetector } from "../hooks/useObjectDetector";
import { addGenericRecord } from "../services/api";
import { classNameJa, tally } from "../utils/detection";
import type { DetectedObject } from "../types";

const DETECT_INTERVAL_MS = 400;

/** Generic real-time "what and how many" counter using an on-device object detection model. */
export function CameraView({ onRecorded }: { onRecorded?: () => void }) {
  const { videoRef, start, stop, active, error: cameraError } = useCamera("environment");
  const { ready, error: modelError, detect } = useObjectDetector();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function loop() {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && video.readyState >= 2) {
        const detections = await detect(video);
        drawOverlay(canvas, video, detections);
        setCounts(tally(detections));
      }
      timer = setTimeout(loop, DETECT_INTERVAL_MS);
    }
    loop();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready]);

  async function handleSave() {
    setSaving(true);
    setSavedMessage(null);
    try {
      for (const [label, quantity] of Object.entries(counts)) {
        await addGenericRecord({ label, quantity });
      }
      setSavedMessage(`記録しました（${Object.keys(counts).length}種類）`);
      onRecorded?.();
    } catch (err) {
      setSavedMessage(`記録に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="camera-view">
      <div className="video-wrap">
        <video ref={videoRef} className="video" playsInline muted />
        <canvas ref={canvasRef} className="overlay" />
      </div>

      <div className="controls">
        {!active ? (
          <button onClick={start}>カメラを開始</button>
        ) : (
          <button onClick={stop}>カメラを停止</button>
        )}
        <button onClick={handleSave} disabled={!active || total === 0 || saving}>
          {saving ? "記録中..." : "この結果を記録する"}
        </button>
      </div>

      {cameraError && <p className="error">カメラエラー: {cameraError}</p>}
      {modelError && <p className="error">モデル読み込みエラー: {modelError}</p>}
      {!ready && active && <p>物体検出モデルを読み込み中...</p>}
      {savedMessage && <p className="status">{savedMessage}</p>}

      <div className="count-panel">
        <h3>リアルタイムカウント（合計 {total}）</h3>
        {Object.keys(counts).length === 0 ? (
          <p className="muted">カメラを対象物に向けてください</p>
        ) : (
          <ul>
            {Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <li key={label}>
                  {classNameJa(label)}: <strong>{count}</strong>
                </li>
              ))}
          </ul>
        )}
        <p className="hint">
          ※ 種類（クラス）単位の一般物体検出です。ワインの銘柄まで数えたい場合は「ワインモード」を使ってください。
        </p>
      </div>
    </div>
  );
}

function drawOverlay(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, detections: DetectedObject[]) {
  if (!canvas) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 3;
  ctx.font = "18px sans-serif";
  ctx.textBaseline = "top";

  for (const d of detections) {
    const [x, y, w, h] = d.bbox;
    ctx.strokeStyle = "#22c55e";
    ctx.strokeRect(x, y, w, h);
    const label = `${classNameJa(d.class)} ${(d.score * 100).toFixed(0)}%`;
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(34,197,94,0.85)";
    ctx.fillRect(x, Math.max(0, y - 22), textWidth + 8, 22);
    ctx.fillStyle = "#0b1a10";
    ctx.fillText(label, x + 4, Math.max(0, y - 20));
  }
}
