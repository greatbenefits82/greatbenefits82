import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Real-time camera detection needs a secure context (HTTPS) on real devices
// (iPhone Safari, Rokid glasses' Android browser) except on localhost, so the
// PWA is configured for offline caching of the TF.js model + app shell too.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "棚卸しカウンター",
        short_name: "棚卸し",
        description: "カメラでその場の物・ワイン銘柄をリアルタイムに数えて記録する棚卸しアプリ",
        theme_color: "#7c2d3e",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
