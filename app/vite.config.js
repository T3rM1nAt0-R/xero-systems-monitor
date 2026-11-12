import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Tauri loads the built files from disk, so paths are relative. In a plain browser the window runs on demo data (src/fakeBackend.js).
export default defineConfig({ base: "./", plugins: [react()], clearScreen: false, server: { port: 5173, strictPort: true } });
