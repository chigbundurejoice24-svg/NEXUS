import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png", "avatar-david.jpg"],
      manifest: {
        name: "AEGIS by Cozanet",
        short_name: "AEGIS",
        description: "Move value across Africa instantly",
        theme_color: "#5B3CF5",
        background_color: "#0B0C10",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/logo.png", sizes: "192x192", type: "image/png" },
          { src: "/logo.png", sizes: "512x512", type: "image/png" },
          { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ],
        categories: ["finance", "utilities"],
        shortcuts: [
          { name: "Send Money",  short_name: "Send",  url: "/money?tab=send",    icons: [{ src: "/logo.png", sizes: "96x96" }] },
          { name: "My Wallets",  short_name: "Wallets", url: "/wallets",          icons: [{ src: "/logo.png", sizes: "96x96" }] },
          { name: "Fund Wallet", short_name: "Fund",  url: "/money?tab=fund",    icons: [{ src: "/logo.png", sizes: "96x96" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.binance\.com/,
            handler: "NetworkFirst",
            options: { cacheName: "binance-cache", expiration: { maxAgeSeconds: 60 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: "CacheFirst",
            options: { cacheName: "gfonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 604800 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
});
