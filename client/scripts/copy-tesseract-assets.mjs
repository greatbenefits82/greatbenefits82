// Self-host the Tesseract.js worker + wasm core instead of relying on a CDN
// at runtime (the app should work in a firewalled warehouse network, and a
// PWA's offline cache can't rely on a third-party CDN staying reachable).
// Language trained-data files are still fetched on demand (they're large and
// tesseract.js caches them in IndexedDB after first use).
import { mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destDir = path.join(__dirname, "..", "public", "tesseract");
mkdirSync(destDir, { recursive: true });

const workerSrc = path.join(path.dirname(require.resolve("tesseract.js/package.json")), "dist", "worker.min.js");
const coreDir = path.dirname(require.resolve("tesseract.js-core/package.json"));

copyFileSync(workerSrc, path.join(destDir, "worker.min.js"));
for (const file of ["tesseract-core-simd-lstm.wasm", "tesseract-core-simd-lstm.js"]) {
  copyFileSync(path.join(coreDir, file), path.join(destDir, file));
}

console.log("[copy-tesseract-assets] copied worker + core files into public/tesseract/");
