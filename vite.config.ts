import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    // Large deterministic floorplan/display seed literals can exhaust the
    // Windows esbuild minifier. Gzip still compresses the static data well.
    minify: false,
  },
});
