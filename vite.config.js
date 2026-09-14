import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.js', restoreMocks: true },
  build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'] } } } },
}));
