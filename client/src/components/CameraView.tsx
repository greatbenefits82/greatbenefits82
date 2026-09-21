import { useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { addGenericRecord, identifyGenericItems } from "../services/api";
import type { GenericVisionItem } from "../types";

type Stage = "idle" | "analyzing" | "review";

/**
 * Generic "what and how many" counting. On-device object detection
 * (COCO-SSD) could only classify into ~80 broad categories and had no way
 * to read a product name off the packaging — a thermometer came back as
 * "toothbrush". This mode instead captures a still frame and sends it to
 * Claude's vision API, which can actually read labels/logos and name
 * specific products. That trades continuous real-time detection for a
 * capture → analyze step (a few seconds, and a per-call API cost).
 */
export function CameraView({ onRecorded }: { onRecorded?: () => void }) {
  const { videoRef, start, stop, active, error: cameraError } = useCamera("environment");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [items, setItems] = useState<GenericVisionItem[]>([]);
  const [notes, setNotes] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function captureFrame(): string | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async function handleAnalyze() {
    setMessage(null);
    const frame = captureFrame();
    if (!frame) {
      setMessage("カメラ映像を取得できませんでした");
      return;
    }
    setStage("analyzing");
    setBusy(true);
    try {
      const result = await identifyGenericItems(frame);
      setItems(result.items);
      setNotes(result.notes ?? null);
      setStage("review");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  function updateQuantity(index: number, quantity: number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, quantity) } : item)));
  }

  function updateName(index: number, name: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, name } : item)));
  }

  async function handleRecordAll() {
    setBusy(true);
    setMessage(null);
    try {
      for (const item of items) {
        await addGenericRecord({ label: item.name, quantity: item.quantity, note: item.category });
      }
      setMessage(`記録しました（${items.length}件）`);
      setItems([]);
      setNotes(null);
      setStage("idle");
      onRecorded?.();
    } catch (err) {
      setMessage(`記録に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="camera-view">
      <div className="video-wrap">
        <video ref={videoRef} className="video" playsInline muted />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      <div className="controls">
        {!active ? (
          <button onClick={start}>カメラを開始</button>
        ) : (
          <button onClick={stop}>カメラを停止</button>
        )}
        <button onClick={handleAnalyze} disabled={!active || busy}>
          {stage === "analyzing" ? "AIが識別中..." : "撮影して識別する"}
        </button>
      </div>

      {cameraError && <p className="error">カメラエラー: {cameraError}</p>}
      {message && <p className={message.includes("失敗") || message.includes("エラー") ? "error" : "status"}>{message}</p>}

      {stage === "review" && (
        <div className="vision-review card">
          <h3>識別結果（{items.length}件）</h3>
          {notes && <p className="muted">{notes}</p>}
          {items.length === 0 ? (
            <p className="muted">物品を識別できませんでした。角度を変えて撮り直してみてください。</p>
          ) : (
            <ul className="candidates">
              {items.map((item, i) => (
                <li key={i} className={item.confidence === "high" ? "high-confidence" : ""}>
                  <div className="item-fields">
                    <input
                      className="name-input"
                      value={item.name}
                      onChange={(e) => updateName(i, e.target.value)}
                    />
                    {item.category && <span className="muted">{item.category}</span>}
                    <span className={`confidence confidence-${item.confidence}`}>
                      {item.confidence === "high" ? "確信度: 高" : item.confidence === "medium" ? "確信度: 中" : "確信度: 低"}
                    </span>
                  </div>
                  <label className="qty">
                    個数
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(i, Number(e.target.value) || 1)}
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 && (
            <button onClick={handleRecordAll} disabled={busy}>
              この内容ですべて記録する
            </button>
          )}
          <button className="secondary" onClick={() => setStage("idle")} disabled={busy}>
            キャンセルしてやり直す
          </button>
        </div>
      )}
    </div>
  );
}
