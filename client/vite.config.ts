import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const injectTimestampPlugin = () => ({
  name: 'inject-timestamp-sw',
  closeBundle() {
    const swPath = path.resolve(__dirname, 'dist', 'sw.js');
    if (fs.existsSync(swPath)) {
      const timestamp = Date.now();
      fs.appendFileSync(swPath, `\n// BUILD_TIMESTAMP: ${timestamp}\n`);
    }
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), injectTimestampPlugin()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 5173
    }
  },
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
  }
}) 