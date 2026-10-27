import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 5173, proxy: { '/api': { target: process.env.API_PROXY_TARGET || 'http://localhost:8081', changeOrigin: true } } },
  build: { outDir: 'dist' }
});
