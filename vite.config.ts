import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Dashboard build: normal SPA, Lovable-kompatibel.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/dashboard"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@schema": path.resolve(__dirname, "./src/types"),
    },
  },
  build: {
    outDir: "dist/dashboard",
  },
});
