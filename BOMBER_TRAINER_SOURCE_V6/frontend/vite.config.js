import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');

// Keep Progress usable even if a secondary collection (weights/goals)
// has stricter PocketBase read rules. Sessions must load independently.
const progressReadFix = () => ({
  name: 'progress-read-fix',
  transform(code, id) {
    if (!id.endsWith('/src/pages/ProgressPage.jsx')) return null;
    const oldBlock = `            const [sessionRows, weightRows, goalRows] = await Promise.all([\n                pb.collection('bt_sessions').getFullList({ sort: '-date', filter: ownerFilter }),\n                pb.collection('bt_weights').getFullList({ sort: '-date', filter: ownerFilter }),\n                pb.collection('bt_goals').getFullList({ sort: '-created', filter: ownerFilter }),\n            ]);\n            setSessions(sessionRows);\n            setWeights(weightRows);\n            setGoals(goalRows);`;
    const newBlock = `            // A permissions issue in weights/goals must never prevent sessions from loading.\n            const [sessionResult, weightResult, goalResult] = await Promise.allSettled([\n                pb.collection('bt_sessions').getFullList({ sort: '-date', filter: ownerFilter }),\n                pb.collection('bt_weights').getFullList({ sort: '-date', filter: ownerFilter }),\n                pb.collection('bt_goals').getFullList({ sort: '-created', filter: ownerFilter }),\n            ]);\n            if (sessionResult.status === 'fulfilled') {\n                setSessions(sessionResult.value);\n            } else {\n                throw sessionResult.reason;\n            }\n            setWeights(weightResult.status === 'fulfilled' ? weightResult.value : []);\n            setGoals(goalResult.status === 'fulfilled' ? goalResult.value : []);`;
    if (!code.includes(oldBlock)) return null;
    return { code: code.replace(oldBlock, newBlock), map: null };
  },
});

export default defineConfig({
  plugins: [react(), progressReadFix()],
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
