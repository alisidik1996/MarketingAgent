import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load .env from monorepo root (two levels up)
  const env = loadEnv(mode, resolve(__dirname, '../../'), '');

  return {
    // Root absolut — bekerja baik saat dipanggil dari mana saja
    root: __dirname,
    publicDir: false,
    build: {
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${env.PORT || 3001}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
    define: {
      // Di Vercel, frontend dan backend ada di domain yang sama (/api/*)
      __API_BASE__:       JSON.stringify('/api'),
      __FALLBACK_TOKEN__: JSON.stringify(env.VITE_META_FALLBACK_TOKEN || ''),
    },
  };
});
