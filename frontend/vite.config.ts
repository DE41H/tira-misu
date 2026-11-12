import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // .env lives in the repo root, shared with the backend.
  const env = loadEnv(mode, '..', '');
  return {
    // Only the site address reaches the SPA (for the Iris links).
    define: { 'import.meta.env.IRIS_URL': JSON.stringify(env.IRIS_URL ?? '') },
    // PocketBase serves this folder (see backend/hooks.go).
    build: { outDir: '../backend/pb_public', emptyOutDir: true },
    // In dev, Vite serves the SPA and forwards API calls to PocketBase.
    server: { proxy: { '/api': 'http://127.0.0.1:8090' } },
    plugins: [svelte({ preprocess: vitePreprocess() })],
  };
});
