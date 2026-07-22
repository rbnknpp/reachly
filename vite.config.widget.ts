import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import path from "node:path";

// Widget build: Library Mode, EIN selbst-enthaltenes IIFE-Bundle.
// Ziel: < 50 kB gzipped. Kein React, Preact statt dessen.
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@widget": path.resolve(__dirname, "./src/widget"),
    },
  },
  build: {
    outDir: "dist/widget",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/widget/main.ts"),
      name: "ReachlyWidget",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
    rollupOptions: {
      output: {
        // Alles in eine Datei, kein separates CSS-Asset (CSS lebt inline im Shadow Root)
        inlineDynamicImports: true,
      },
    },
    minify: "esbuild",
    target: "es2018",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
