import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [
    react(),
    {
      name: 'favicon-ico-handler',
      configureServer(server) {
        // Handle favicon.ico requests early in the middleware chain
        server.middlewares.use((req, res, next) => {
          if (req.url === '/favicon.ico' || req.url?.endsWith('/favicon.ico')) {
            // Serve favicon.svg instead of redirecting to prevent multiple requests
            req.url = '/favicon.svg';
          }
          next();
        });
      }
    }
  ],
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
    minify: 'esbuild',
    // Remove console.log and debugger statements in production builds
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
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
}));
