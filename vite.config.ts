import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// No GitHub Pages o site fica em https://usuario.github.io/nome-do-repo/.
// O workflow define VITE_BASE_PATH=/nome-do-repo/ automaticamente.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    build: { sourcemap: false, target: 'es2020', chunkSizeWarningLimit: 800 },
  };
});
