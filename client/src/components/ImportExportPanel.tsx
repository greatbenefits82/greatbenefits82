import { useEffect, useState } from "react";
import { getFormat, importSpreadsheet, exportUrl } from "../services/api";
import type { DetectedFormat } from "../types";

export function ImportExportPanel({ onImported }: { onImported: () => void }) {
  const [format, setFormat] = useState<DetectedFormat | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getFormat()
      .then((r) => setFormat(r.format))
      .catch(() => undefined);
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await importSpreadsheet(file);
      setFormat(result.format);
      setMessage(
        result.format.isExistingFormat
          ? `既存フォーマットを認識し、${result.importedCount}件の銘柄を取り込みました。`
          : "既存フォーマットを認識できなかったため、独自フォーマットで新規作成しました。"
      );
      onImported();
    } catch (err) {
      setMessage(`インポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-export-panel">
      <h3>既存の棚卸し表</h3>
      <p className="muted">
        既存の棚卸し表（.xlsx / .csv）をアップロードすると列構成を自動判定し、その中からワインを検索・記録します。
        アップロードしない場合は独自フォーマットで新規に記録します。
      </p>
      <label className="file-input">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={busy} />
        {busy ? "取り込み中..." : "棚卸し表をアップロード"}
      </label>

      {message && <p className="status">{message}</p>}

      {format && (
        <p className="muted">
          現在のフォーマット: {format.isExistingFormat ? "既存フォーマット" : "オリジナルフォーマット"}（
          {format.headers.join(" / ")}）
        </p>
      )}

      <a className="button-like" href={exportUrl()} target="_blank" rel="noreferrer">
        現在の棚卸し結果をExcelでエクスポート
      </a>
    </div>
  );
}
