import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../..', import.meta.url));
  const env = loadEnv(mode, envDir, 'VITE_');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (key.startsWith('sb_secret_') || key.split('.')[1] &&
      JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role') {
    throw new Error('Chave de servidor não pode ser usada na aplicação pública.');
  }
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    envDir,
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    build: { outDir: '../../dist/vitrine', emptyOutDir: true },
  };
});
