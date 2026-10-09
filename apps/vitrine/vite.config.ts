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
  if (process.env.VERCEL_ENV === 'production' && env.VITE_APP_ENV!=='production') {
    throw new Error('Deploy de produção exige configuração exclusiva de produção.');
  }
  if (preview && env.VITE_APP_ENV !== 'homologation') {
    throw new Error('O preview Vercel deve usar o ambiente de homologação.');
  }
  validarAmbiente(env, preview||process.env.VERCEL_ENV==='production');
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    envDir,
    envPrefix: [...variaveisPublicas],
    plugins: [react(),{name:'validacao-responsiva-preview',apply:'build',generateBundle(){if(env.VITE_APP_ENV==='homologation')this.emitFile({type:'asset',fileName:'validacao-mobile.html',source:`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Validação Rose Modas — 375 px</title><style>body{margin:0;background:#eee;font:14px sans-serif;text-align:center}nav{padding:8px}a{margin:0 12px}iframe{display:block;width:375px;height:812px;border:0;margin:0 auto;background:white}</style><nav><a href="?pagina=painel">Painel · 375 px</a><a href="?pagina=vitrine">Vitrine · 375 px</a></nav><iframe title="Rose Modas em 375 px" src="/"></iframe><script>const q=new URLSearchParams(location.search);document.querySelector('iframe').src=(q.get('oficial')==='1'?'https://rosemenezesmodas.com.br':'')+(q.get('pagina')==='painel'?'/painel':'/');</script></html>`});}}],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    build: { outDir: '../../dist/vitrine', emptyOutDir: true },
  };
});
