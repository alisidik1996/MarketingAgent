import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load .env from monorepo root (two levels up)
  const env = loadEnv(mode, '../../', '');

  return {
    root: '.',
    publicDir: false,
    build: {
      outDir: 'dist',
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
      // Expose only safe non-secret values to the browser
      __API_BASE__:           JSON.stringify(mode === 'production' ? (env.VITE_API_BASE_PROD || '/api') : '/api'),
      __FALLBACK_TOKEN__:     JSON.stringify(env.VITE_META_FALLBACK_TOKEN || ''),
    },
  };
});
