import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // force the npm buffer polyfill instead of the externalized Node builtin
    alias: { buffer: 'buffer/' },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: { port: 5173 },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
