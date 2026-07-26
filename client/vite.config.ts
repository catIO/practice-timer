/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const injectTimestampPlugin = () => ({
  name: 'inject-timestamp-sw',
  closeBundle() {
    const swPath = path.resolve(__dirname, 'dist', 'sw.js');
    if (fs.existsSync(swPath)) {
      try {
        let swContent = fs.readFileSync(swPath, 'utf8');
        const timestamp = Date.now();
        swContent = swContent.replace(
          /const CACHE_NAME = '([^']+)';/,
          (match, p1) => `const CACHE_NAME = '${p1}-${timestamp}';`
        );
        swContent += `\n// BUILD_TIMESTAMP: ${timestamp}\n`;
        fs.writeFileSync(swPath, swContent, 'utf8');
        console.log(`[inject-timestamp-sw] Injected build version into dist/sw.js (timestamp: ${timestamp})`);
      } catch (e) {
        console.error('[inject-timestamp-sw] Failed to inject build version:', e);
      }
    }
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), injectTimestampPlugin()],
  envDir: path.resolve(__dirname, '..'),
  define: {
    // Netlify's Supabase integration sets SUPABASE_DATABASE_URL and SUPABASE_ANON_KEY
    // (no VITE_ prefix). Map them to VITE_* so the client can read them.
    ...((process.env.SUPABASE_URL || process.env.SUPABASE_DATABASE_URL) && {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        process.env.SUPABASE_URL || process.env.SUPABASE_DATABASE_URL
      ),
    }),
    ...(process.env.SUPABASE_ANON_KEY && {
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
    }),
  },
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
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  }
}) 