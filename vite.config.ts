import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Build ID format: version+YYYYMMDD.git_hash (e.g., 0.1.0+20250206.a1b2c3d)
// Set via VITE_BUILD_ID env var during release builds
// Fallback to dev+timestamp for development mode
const getDevBuildId = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
  return `dev+${date}.${time}`;
};

const buildId = process.env.VITE_BUILD_ID || getDevBuildId();

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite options tailored for Tauri development and only applied when `npm run tauri dev` or `npm run tauri build`
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: false,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  },
  // Prevent Vite from clearing the terminal
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri supports es2021
    target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
