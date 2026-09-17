import { useEffect, useState } from "react";
import { listMaster, listRecords } from "../services/api";
import type { CountRecord, MasterItem } from "../types";

export function InventoryTable({ refreshSignal }: { refreshSignal: number }) {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [records, setRecords] = useState<CountRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMaster(), listRecords()])
      .then(([m, r]) => {
        if (cancelled) return;
        setItems(m.items);
        setRecords(r.records);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  return (
    <div className="inventory-table">
      {error && <p className="error">{error}</p>}

      <h3>現在の棚卸しマスタ（{items.length}銘柄 / 合計 {items.reduce((s, i) => s + i.quantity, 0)}本）</h3>
      {items.length === 0 ? (
        <p className="muted">まだ記録がありません。カメラで撮影して数えるか、既存の棚卸し表をインポートしてください。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>銘柄</th>
              <th>生産者</th>
              <th>ヴィンテージ</th>
              <th>種別</th>
              <th>数量</th>
              <th>場所</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.brand}</td>
                <td>{item.producer ?? "-"}</td>
                <td>{item.vintage ?? "-"}</td>
                <td>{item.category ?? "-"}</td>
                <td>{item.quantity}</td>
                <td>{item.location ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>記録ログ（直近{Math.min(records.length, 20)}件）</h3>
      {records.length === 0 ? (
        <p className="muted">まだ記録がありません。</p>
      ) : (
        <ul className="record-log">
          {records.slice(0, 20).map((r) => (
            <li key={r.id}>
              <span className="ts">{new Date(r.timestamp).toLocaleString("ja-JP")}</span>
              <span className={`mode mode-${r.mode}`}>{r.mode === "wine" ? "ワイン" : "一般"}</span>
              {r.label} +{r.quantity}
              {r.matchScore !== undefined && (
                <span className="muted"> (一致度 {(100 - r.matchScore * 100).toFixed(0)}%)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
