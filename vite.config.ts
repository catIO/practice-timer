import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  root: "client",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/settings': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    },
    fs: {
      strict: false
    },
    hmr: {
      port: 5173,
      clientPort: 5173,
    }
  },
  worker: {
    format: 'es'
  }
});
