import { lazy, Suspense, useState } from "react";
import { InventoryTable } from "./components/InventoryTable";
import { ImportExportPanel } from "./components/ImportExportPanel";
import "./index.css";

// Each mode pulls in a heavy on-device model (TensorFlow.js / Tesseract.js);
// code-splitting keeps the initial load light on phones and smart glasses.
const CameraView = lazy(() => import("./components/CameraView").then((m) => ({ default: m.CameraView })));
const WineCaptureMode = lazy(() =>
  import("./components/WineCaptureMode").then((m) => ({ default: m.WineCaptureMode }))
);

type Tab = "generic" | "wine" | "inventory";

export default function App() {
  const [tab, setTab] = useState<Tab>("wine");
  const [refreshSignal, setRefreshSignal] = useState(0);
  const bump = () => setRefreshSignal((n) => n + 1);

  return (
    <div className="app">
      <header>
        <h1>棚卸しカウンター</h1>
        <p className="subtitle">カメラで対象を映して、その場で数えて記録します</p>
      </header>

      <nav className="tabs">
        <button className={tab === "wine" ? "active" : ""} onClick={() => setTab("wine")}>
          ワインモード
        </button>
        <button className={tab === "generic" ? "active" : ""} onClick={() => setTab("generic")}>
          一般物体カウント
        </button>
        <button className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>
          棚卸し表・記録
        </button>
      </nav>

      <main>
        <Suspense fallback={<p className="muted">読み込み中...</p>}>
          {tab === "wine" && <WineCaptureMode onRecorded={bump} />}
          {tab === "generic" && <CameraView onRecorded={bump} />}
        </Suspense>
        {tab === "inventory" && (
          <>
            <ImportExportPanel onImported={bump} />
            <InventoryTable refreshSignal={refreshSignal} />
          </>
        )}
      </main>
    </div>
  );
}
