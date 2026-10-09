import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Loja } from './Loja';
import './styles.css';
import { entradaInterna } from './painel/catalogoInterno';
import { lazy, Suspense } from 'react';

const Painel = lazy(() => import('./painel/Painel').then(m => ({ default: m.Painel })));
const AreaCliente = lazy(() => import('./cliente/AreaCliente').then(m => ({ default: m.AreaCliente })));
function Aplicacao(){
  const [rota,setRota]=useState(window.location.hash);
  useEffect(()=>{const mudar=()=>setRota(window.location.hash);window.addEventListener('hashchange',mudar);return()=>window.removeEventListener('hashchange',mudar);},[]);
  const cliente=rota==='#/cliente'||rota.startsWith('#/cliente/')||window.location.pathname==='/cliente'||window.location.pathname.startsWith('/cliente/');
  const painel=entradaInterna(window.location.hostname,window.location.pathname)||rota==='#/painel'||rota.startsWith('#/painel/');
  return <Suspense fallback={<p role="status">Carregando…</p>}>{cliente?<AreaCliente/>:painel?<Painel/>:<Loja/>}</Suspense>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz ausente.');
createRoot(root).render(<StrictMode><Aplicacao/></StrictMode>);
