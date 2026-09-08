import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Proxy API calls to the backend service (uses Docker internal hostname)
      // VITE_API_URL is used for browser-side absolute URLs only
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
});
