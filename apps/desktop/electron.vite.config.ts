import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    define: { __DRAFT_REPO__: JSON.stringify(resolve(__dirname, "..", "..")) },
    build: { externalizeDeps: { exclude: ["@draft/core"] } },
  },
  preload: {},
  renderer: { plugins: [react(), tailwindcss()] },
});
