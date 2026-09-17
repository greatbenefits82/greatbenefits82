import { useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { useOCR } from "../hooks/useOCR";
import { confirmWine, lookupWineOnline, matchWine } from "../services/api";
import type { WineCandidate, WineLookupResult } from "../types";

type Stage = "idle" | "ocr" | "matching" | "review";

/**
 * Wine mode: instead of continuous real-time detection (a generic detector
 * cannot read the small label text that actually distinguishes one wine
 * from another), the flow is capture -> OCR the label -> match against the
 * existing wine list -> human confirms, because two bottles that look
 * identical at a glance can differ only in a vintage year or a few words of
 * small print. The OCR text is always shown and editable before matching so
 * a misread doesn't silently miscount the wrong bottle.
 */
export function WineCaptureMode({ onRecorded }: { onRecorded?: () => void }) {
  const { videoRef, start, stop, active, error: cameraError } = useCamera("environment");
  const { ready: ocrReady, error: ocrError, recognize } = useOCR();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [ocrText, setOcrText] = useState("");
  const [candidates, setCandidates] = useState<WineCandidate[]>([]);
  const [threshold, setThreshold] = useState(0.3);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const [manual, setManual] = useState({ brand: "", producer: "", vintage: "", category: "" });
  const [lookupResults, setLookupResults] = useState<WineLookupResult[] | null>(null);
  const [lookupInfo, setLookupInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function captureFrame(): HTMLCanvasElement | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function handleCapture() {
    setMessage(null);
    setLookupResults(null);
    const frame = captureFrame();
    if (!frame) {
      setMessage("カメラ映像を取得できませんでした");
      return;
    }
    setStage("ocr");
    setBusy(true);
    try {
      const text = await recognize(frame);
      setOcrText(text);
      setStage("matching");
      await runMatch(text);
    } catch (err) {
      setMessage(`OCRに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  async function runMatch(text: string) {
    setBusy(true);
    try {
      const { candidates, highConfidenceThreshold } = await matchWine(text);
      setCandidates(candidates);
      setThreshold(highConfidenceThreshold);
      setStage("review");
      const best = candidates[0];
      if (best) {
        setManual({
          brand: best.brand,
          producer: best.producer ?? "",
          vintage: best.vintage ?? "",
          category: "",
        });
      }
    } catch (err) {
      setMessage(`照合に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmCandidate(candidate: WineCandidate) {
    setBusy(true);
    setMessage(null);
    try {
      await confirmWine({ masterId: candidate.masterId, quantity, ocrText, matchScore: candidate.score });
      setMessage(`「${candidate.brand}」を +${quantity} 本 記録しました`);
      resetToIdle();
      onRecorded?.();
    } catch (err) {
      setMessage(`記録に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterNew() {
    if (!manual.brand.trim()) {
      setMessage("銘柄名を入力してください");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await confirmWine({
        brand: manual.brand.trim(),
        producer: manual.producer.trim() || undefined,
        vintage: manual.vintage.trim() || undefined,
        category: manual.category.trim() || undefined,
        quantity,
        ocrText,
        note: "既存棚卸し表に無かった新規銘柄",
      });
      setMessage(`新規銘柄「${manual.brand}」として +${quantity} 本 記録しました`);
      resetToIdle();
      onRecorded?.();
    } catch (err) {
      setMessage(`記録に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleOnlineLookup() {
    const query = (ocrText || manual.brand).trim();
    if (!query) return;
    setBusy(true);
    setLookupInfo(null);
    try {
      const { configured, results } = await lookupWineOnline(query);
      setLookupResults(results);
      if (!configured) {
        setLookupInfo(
          "オンライン検索プロバイダが未設定です（サーバーの GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX を設定してください）。手動で銘柄を入力してください。"
        );
      } else if (results.length === 0) {
        setLookupInfo("該当する候補が見つかりませんでした。手動で銘柄を入力してください。");
      }
    } catch (err) {
      setLookupInfo(`オンライン検索に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function resetToIdle() {
    setStage("idle");
    setOcrText("");
    setCandidates([]);
    setManual({ brand: "", producer: "", vintage: "", category: "" });
    setLookupResults(null);
    setQuantity(1);
  }

  const bestScore = candidates[0]?.score;
  const hasHighConfidenceMatch = bestScore !== undefined && bestScore <= threshold;

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
        <button onClick={handleCapture} disabled={!active || !ocrReady || busy}>
          {stage === "ocr" ? "文字を読み取り中..." : "ラベルを撮影して読み取る"}
        </button>
      </div>

      {cameraError && <p className="error">カメラエラー: {cameraError}</p>}
      {ocrError && <p className="error">OCRエラー: {ocrError}</p>}
      {!ocrReady && <p className="muted">OCRエンジンを準備中...（初回は言語データのダウンロードに時間がかかります）</p>}
      {message && <p className="status">{message}</p>}

      {stage !== "idle" && (
        <div className="wine-review">
          <label>
            読み取ったラベル文字（誤読があれば修正してから照合し直せます）
            <textarea
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              rows={3}
              disabled={busy}
            />
          </label>
          <button onClick={() => runMatch(ocrText)} disabled={busy || !ocrText.trim()}>
            この文字で既存棚卸し表と照合する
          </button>

          <label className="qty">
            本数
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>

          {stage === "review" && (
            <>
              <h4>既存棚卸し表からの候補</h4>
              {candidates.length === 0 ? (
                <p className="muted">一致する銘柄が既存棚卸し表に見つかりませんでした。</p>
              ) : (
                <ul className="candidates">
                  {candidates.map((c) => (
                    <li key={c.masterId} className={c.score <= threshold ? "high-confidence" : ""}>
                      <div>
                        <strong>{c.brand}</strong>
                        {c.producer && <span> / {c.producer}</span>}
                        {c.vintage && <span> ({c.vintage})</span>}
                        <span className="score"> 一致度 {(100 - c.score * 100).toFixed(0)}%</span>
                        {c.score > threshold && (
                          <span className="warn"> ※文字が微妙に違う可能性があります。よく確認してください</span>
                        )}
                      </div>
                      <button onClick={() => handleConfirmCandidate(c)} disabled={busy}>
                        この銘柄で +{quantity}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!hasHighConfidenceMatch && (
                <div className="new-wine">
                  <h4>見つからない / 違う場合：新しい銘柄として記録</h4>
                  <button onClick={handleOnlineLookup} disabled={busy}>
                    オンラインで銘柄を検索する
                  </button>
                  {lookupInfo && <p className="muted">{lookupInfo}</p>}
                  {lookupResults && lookupResults.length > 0 && (
                    <ul className="lookup-results">
                      {lookupResults.map((r, i) => (
                        <li key={i}>
                          <button
                            className="link-like"
                            onClick={() => setManual((m) => ({ ...m, brand: r.title }))}
                          >
                            {r.title}
                          </button>
                          {r.snippet && <p className="snippet">{r.snippet}</p>}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="manual-form">
                    <input
                      placeholder="銘柄（必須）"
                      value={manual.brand}
                      onChange={(e) => setManual((m) => ({ ...m, brand: e.target.value }))}
                    />
                    <input
                      placeholder="生産者"
                      value={manual.producer}
                      onChange={(e) => setManual((m) => ({ ...m, producer: e.target.value }))}
                    />
                    <input
                      placeholder="ヴィンテージ（年）"
                      value={manual.vintage}
                      onChange={(e) => setManual((m) => ({ ...m, vintage: e.target.value }))}
                    />
                    <input
                      placeholder="種別（赤/白/スパークリング等）"
                      value={manual.category}
                      onChange={(e) => setManual((m) => ({ ...m, category: e.target.value }))}
                    />
                    <button onClick={handleRegisterNew} disabled={busy}>
                      新規銘柄として +{quantity} 記録
                    </button>
                  </div>
                </div>
              )}

              <button className="secondary" onClick={resetToIdle} disabled={busy}>
                キャンセルしてやり直す
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
