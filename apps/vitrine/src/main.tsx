import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Loja } from './Loja';
import './styles.css';
import { entradaInterna } from './painel/catalogoInterno';
import { lazy, Suspense } from 'react';

const Painel = lazy(() => import('./painel/Painel').then(m => ({ default: m.Painel })));

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz ausente.');
createRoot(root).render(<StrictMode>{entradaInterna(window.location.hostname,window.location.pathname)
  ? <Suspense fallback={<p role="status">Carregando acesso interno…</p>}><Painel/></Suspense> : <Loja/>}</StrictMode>);
