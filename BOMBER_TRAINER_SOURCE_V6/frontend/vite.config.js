import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/lib', replacement: srcDir },
      { find: '@', replacement: srcDir },
    ],
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
  },
});
