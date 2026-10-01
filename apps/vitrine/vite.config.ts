import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validarAmbiente } from './src/ambiente.ts';

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../..', import.meta.url));
  const env = loadEnv(mode, envDir, 'VITE_');
  const preview = process.env.VERCEL_ENV === 'preview';
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('Deploy de produção não está autorizado nesta etapa.');
  }
  if (preview && env.VITE_APP_ENV !== 'homologation') {
    throw new Error('O preview Vercel deve usar o ambiente de homologação.');
  }
  validarAmbiente(env, preview);
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    envDir,
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    build: { outDir: '../../dist/vitrine', emptyOutDir: true },
  };
});
