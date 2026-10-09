import { useState } from 'react';
import { formas, icones, referencia } from './referencia';
import { fotoPrincipal, urlDaMidia } from './catalogo';
import type { Catalogo, Produto } from './catalogo';
export const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
export const selos = { aprovado_rose: 'Aprovado pela Rose', novidade: 'Novidade', ultimas_pecas: 'Últimas peças' };
export const classeSelo = (p: Produto) => p.selo === 'aprovado_rose' ? 't-rose' : p.selo === 'ultimas_pecas' ? 't-warn' : 't-gold';
export const demoDaPeca = (p: Produto) => p.codigo.startsWith('HOM-') ? referencia.find(d => `HOM-${d.id}` === p.codigo) : undefined;
export function Icone({ nome }: { nome: string }) { return <span aria-hidden="true" style={{display:'contents'}} dangerouslySetInnerHTML={{__html:icones[nome] ?? ''}} />; }
export function Marca({ catalogo }: { catalogo: Catalogo | null }) {
  const logo = catalogo?.logoUrl ?? '/marca/rose-menezes.jpg';
  const [falha, setFalha] = useState<string | null>(null);
  return <><img src={falha === logo ? '/marca/rose-menezes.jpg' : logo} alt="Rose Menezes" width="42" height="42" onError={() => setFalha(logo)} />
    <span className="n">{catalogo?.nomeLoja ?? 'Rose Menezes'}<small>MODA FEMININA</small></span></>;
}
export function Arte({ produto, cor, variante = 0, hero = false }: { produto: Produto; cor?: string; variante?: number; hero?: boolean }) {
  const d = demoDaPeca(produto);
  const foto = fotoPrincipal(produto), url = foto ? urlDaMidia(foto.caminho_storage) : null;
  const [falha, setFalha] = useState<string | null>(null);
  if (url && url !== falha) return <img src={url} alt={foto!.alt_texto} loading={hero ? 'eager' : 'lazy'} decoding="async" onError={() => setFalha(url)} />;
  if (!d) return <div className="sem-foto"><span>Rose Menezes</span><small>Foto em breve</small></div>;
  const indice = referencia.indexOf(d), cores = d.cores as readonly { n: string; hex: string }[];
  const corHex = cores.find(c => c.n === cor)?.hex ?? cores[0].hex;
  const fundo = ['#FAEDED', '#F3EBE2', '#F7F1EA', '#F6E6E6'][(indice + variante) % 4];
  const transform = variante === 1 ? 'rotate(-4 100 140)' : variante === 2 ? 'translate(0 6) scale(.94) translate(6 0)' : undefined;
  return <svg viewBox="0 0 200 260" preserveAspectRatio={`xMidYMid ${hero ? 'meet' : 'slice'}`} role="img" aria-label={`Ilustração demonstrativa: ${produto.nome}`}>
    <rect width="200" height="260" fill={fundo} /><circle cx="100" cy="138" r={variante === 2 ? 92 : 84} fill="#fff" opacity=".55" />
    <path d="M100 30 v12 M80 44 Q100 30 120 44" stroke="#B98B4E" strokeWidth="1.6" fill="none" opacity=".7" />
    <g transform={transform} fill={corHex} stroke="rgba(0,0,0,.08)" strokeWidth="1" dangerouslySetInnerHTML={{__html:formas[d.forma]}} />
  </svg>;
}
