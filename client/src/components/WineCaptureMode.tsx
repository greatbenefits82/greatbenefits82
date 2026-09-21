import { useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { confirmWine, identifyWineLabels, lookupWineOnline, matchWine } from "../services/api";
import { buildWineMatchQuery } from "../utils/wineQuery";
import type { VisionConfidence, WineCandidate, WineLookupResult } from "../types";

type Stage = "idle" | "analyzing" | "review";
type PendingStatus = "pending" | "confirmed" | "skipped";

interface PendingWine {
  brand: string;
  producer: string;
  vintage: string;
  category: string;
  quantity: number;
  confidence: VisionConfidence;
  rawLabelText?: string;
  candidates: WineCandidate[];
  status: PendingStatus;
  lookupResults?: WineLookupResult[];
  lookupInfo?: string;
}

const HIGH_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Wine mode: capture the shelf/label → Claude's vision API reads every
 * label it can see (brand, producer, vintage) in one pass, since near-
 * identical bottles can differ only in a vintage year or a few words of
 * small print that a generic detector can't read at all. Each detected
 * wine is then matched against the imported inventory sheet server-side
 * (unchanged fuzzy-match logic) and shown for human confirmation — the
 * model's read is never auto-committed, since OCR/vision misreads on tiny
 * label text are still possible.
 */
export function WineCaptureMode({ onRecorded }: { onRecorded?: () => void }) {
  const { videoRef, start, stop, active, error: cameraError } = useCamera("environment");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [wines, setWines] = useState<PendingWine[]>([]);
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
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  async function handleCapture() {
    setMessage(null);
    const frame = captureFrame();
    if (!frame) {
      setMessage("カメラ映像を取得できませんでした");
      return;
    }
    setStage("analyzing");
    setBusy(true);
    try {
      const result = await identifyWineLabels(frame);
      setNotes(result.notes ?? null);
      const withCandidates = await Promise.all(
        result.wines.map(async (w) => {
          const { candidates } = await matchWine(buildWineMatchQuery(w));
          return {
            brand: w.brand,
            producer: w.producer ?? "",
            vintage: w.vintage ?? "",
            category: w.category ?? "",
            quantity: w.quantity,
            confidence: w.confidence,
            rawLabelText: w.rawLabelText,
            candidates,
            status: "pending" as PendingStatus,
          };
        })
      );
      setWines(withCandidates);
      setStage("review");
      if (withCandidates.length === 0) {
        setMessage("ワインのラベルを検出できませんでした。角度を変えて撮り直してみてください。");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  function updateWine(index: number, patch: Partial<PendingWine>) {
    setWines((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  async function handleConfirmCandidate(index: number, candidate: WineCandidate) {
    const wine = wines[index];
    setBusy(true);
    try {
      await confirmWine({
        masterId: candidate.masterId,
        quantity: wine.quantity,
        ocrText: wine.rawLabelText,
        matchScore: candidate.score,
      });
      updateWine(index, { status: "confirmed" });
      onRecorded?.();
    } catch (err) {
      setMessage(`記録に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterNew(index: number) {
    const wine = wines[index];
    if (!wine.brand.trim()) {
      setMessage("銘柄名を入力してください");
      return;
    }
    setBusy(true);
    try {
      await confirmWine({
        brand: wine.brand.trim(),
        producer: wine.producer.trim() || undefined,
        vintage: wine.vintage.trim() || undefined,
        category: wine.category.trim() || undefined,
        quantity: wine.quantity,
        ocrText: wine.rawLabelText,
        note: "既存棚卸し表に無かった新規銘柄",
      });
      updateWine(index, { status: "confirmed" });
      onRecorded?.();
    } catch (err) {
      setMessage(`記録に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleOnlineLookup(index: number) {
    const wine = wines[index];
    const query = wine.rawLabelText || wine.brand;
    if (!query.trim()) return;
    setBusy(true);
    try {
      const { configured, results } = await lookupWineOnline(query);
      updateWine(index, {
        lookupResults: results,
        lookupInfo: !configured
          ? "オンライン検索プロバイダが未設定です（サーバーの GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX を設定してください）。"
          : results.length === 0
            ? "該当する候補が見つかりませんでした。"
            : undefined,
      });
    } catch (err) {
      updateWine(index, { lookupInfo: `オンライン検索に失敗しました: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(false);
    }
  }

  function resetToIdle() {
    setStage("idle");
    setWines([]);
    setNotes(null);
  }

  return (
    <div className="wine-mode">
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
        <button onClick={handleCapture} disabled={!active || busy}>
          {stage === "analyzing" ? "AIがラベルを読み取り中..." : "撮影してラベルを読み取る"}
        </button>
      </div>

      {cameraError && <p className="error">カメラエラー: {cameraError}</p>}
      {message && <p className={message.includes("失敗") || message.includes("できません") ? "error" : "status"}>{message}</p>}

      {stage === "review" && wines.length > 0 && (
        <div className="wine-review">
          {notes && <p className="muted card">{notes}</p>}
          {wines.map((wine, i) => (
            <div key={i} className={`card wine-card ${wine.status === "confirmed" ? "confirmed" : ""}`}>
              {wine.status === "confirmed" ? (
                <p className="status">✓ 「{wine.brand}」を +{wine.quantity} 本 記録しました</p>
              ) : (
                <>
                  <div className="item-fields">
                    <input value={wine.brand} onChange={(e) => updateWine(i, { brand: e.target.value })} placeholder="銘柄" />
                    <span className={`confidence confidence-${wine.confidence}`}>
                      {wine.confidence === "high" ? "確信度: 高" : wine.confidence === "medium" ? "確信度: 中" : "確信度: 低（要確認）"}
                    </span>
                  </div>
                  <div className="manual-form">
                    <input value={wine.producer} onChange={(e) => updateWine(i, { producer: e.target.value })} placeholder="生産者" />
                    <input value={wine.vintage} onChange={(e) => updateWine(i, { vintage: e.target.value })} placeholder="ヴィンテージ（年）" />
                    <input value={wine.category} onChange={(e) => updateWine(i, { category: e.target.value })} placeholder="種別（赤/白/スパークリング等）" />
                  </div>
                  {wine.rawLabelText && <p className="muted raw-text">読み取り文字: {wine.rawLabelText}</p>}
                  <label className="qty">
                    本数
                    <input
                      type="number"
                      min={1}
                      value={wine.quantity}
                      onChange={(e) => updateWine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </label>

                  {wine.candidates.length > 0 && (
                    <>
                      <h4>既存棚卸し表からの候補</h4>
                      <ul className="candidates">
                        {wine.candidates.map((c) => (
                          <li key={c.masterId} className={c.score <= HIGH_CONFIDENCE_THRESHOLD ? "high-confidence" : ""}>
                            <div>
                              <strong>{c.brand}</strong>
                              {c.producer && <span> / {c.producer}</span>}
                              {c.vintage && <span> ({c.vintage})</span>}
                              <span className="score"> 一致度 {(100 - c.score * 100).toFixed(0)}%</span>
                              {c.score > HIGH_CONFIDENCE_THRESHOLD && (
                                <span className="warn"> ※文字が微妙に違う可能性があります</span>
                              )}
                            </div>
                            <button onClick={() => handleConfirmCandidate(i, c)} disabled={busy}>
                              この銘柄で +{wine.quantity}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <div className="new-wine">
                    <button className="secondary" onClick={() => handleOnlineLookup(i)} disabled={busy}>
                      オンラインで銘柄を検索する
                    </button>
                    {wine.lookupInfo && <p className="muted">{wine.lookupInfo}</p>}
                    {wine.lookupResults && wine.lookupResults.length > 0 && (
                      <ul className="lookup-results">
                        {wine.lookupResults.map((r, ri) => (
                          <li key={ri}>
                            <button className="link-like" onClick={() => updateWine(i, { brand: r.title })}>
                              {r.title}
                            </button>
                            {r.snippet && <p className="snippet">{r.snippet}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button onClick={() => handleRegisterNew(i)} disabled={busy}>
                      この内容で新規銘柄として +{wine.quantity} 記録
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          <button className="secondary" onClick={resetToIdle} disabled={busy}>
            閉じてやり直す
          </button>
        </div>
      )}
    </div>
  );
}
