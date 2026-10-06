import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validarAmbiente, variaveisPublicas } from './src/ambiente.ts';

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../..', import.meta.url));
  // A Vercel acrescenta metadados com VITE_VERCEL_; eles não pertencem à aplicação.
  const env = Object.fromEntries(Object.entries(loadEnv(mode, envDir, 'VITE_'))
    .filter(([nome]) => !nome.startsWith('VITE_VERCEL_')));
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
    envPrefix: [...variaveisPublicas],
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    build: { outDir: '../../dist/vitrine', emptyOutDir: true },
  };
});
