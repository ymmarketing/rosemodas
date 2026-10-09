import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consultarPedidos, consultarDetalhes, rotuloStatus } from './pedidos';
import type { Pedido, DetalhesPedido } from './pedidos';
import { moeda } from '../Visual';
import './cliente.css';
const dataLocal=(d:string)=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(d));
export function Pedidos({sb,admin=false}:{sb:SupabaseClient;admin?:boolean}) {
  const [pedidos,setPedidos]=useState<Pedido[]>([]),[pedido,setPedido]=useState<Pedido|null>(null),[detalhes,setDetalhes]=useState<DetalhesPedido|null>(null);
  const [carregando,setCarregando]=useState(true),[erro,setErro]=useState(''),[revisao,setRevisao]=useState(0);
  useEffect(()=>{let vivo=true;setErro('');setCarregando(true);consultarPedidos(sb).then(d=>{if(vivo)setPedidos(d);}).catch(e=>{if(vivo)setErro(e.message);}).finally(()=>{if(vivo)setCarregando(false);});return()=>{vivo=false;};},[sb,revisao]);
  useEffect(()=>{if(!pedido)return;let vivo=true;setDetalhes(null);setErro('');consultarDetalhes(sb,pedido.id).then(d=>{if(vivo)setDetalhes(d);}).catch(e=>{if(vivo)setErro(e.message);});return()=>{vivo=false;};},[sb,pedido,revisao]);
  return <section className="compras"><h1>{pedido?pedido.numero:admin?'Pedidos':'Minhas compras'}</h1>
    {erro&&<div className="erro-acesso" role="alert">{erro} <button className="btn btn-s btn-sm" onClick={()=>setRevisao(n=>n+1)}>Tentar novamente</button></div>}
    {pedido?<>
      <button className="link-acesso" onClick={()=>setPedido(null)}>‹ Voltar aos pedidos</button>
      <div className="resumo-pedido"><span className="pill">{rotuloStatus(pedido.status_pedido)}</span><span>{dataLocal(pedido.criado_em)}</span><strong>{moeda(pedido.total)}</strong></div>
      <div className="cards-compra"><article className="card-compra"><h2>Status</h2><p>Pedido: {rotuloStatus(pedido.status_pedido)}</p><p>Pagamento: {rotuloStatus(pedido.status_pagamento)}</p><p>Preparação: {rotuloStatus(pedido.status_fulfillment)}</p><p>Entrega: {rotuloStatus(pedido.status_envio)}</p></article>
        <article className="card-compra"><h2>Peças</h2>{!detalhes?<p role="status">Carregando detalhes…</p>:detalhes.itens.map(i=><div className="item-compra" key={i.id}><b>{i.nome_snapshot}</b><p>{i.sku_snapshot} · {i.cor_snapshot} · {i.tamanho_snapshot} · {i.quantidade} unidade(s)</p><strong>{moeda(i.total_item)}</strong></div>)}<p>Subtotal: {moeda(pedido.subtotal)}</p><p>Desconto: {moeda(pedido.desconto)}</p><p>Frete: {moeda(pedido.frete_cobrado)}</p><strong>Total: {moeda(pedido.total)}</strong></article>
        {detalhes?.endereco&&<article className="card-compra"><h2>Entrega</h2><p>{detalhes.endereco.nome_destinatario}</p><p>{detalhes.endereco.rua}, {detalhes.endereco.numero}{detalhes.endereco.complemento?` · ${detalhes.endereco.complemento}`:''}</p><p>{detalhes.endereco.bairro} · {detalhes.endereco.cidade}/{detalhes.endereco.uf}</p><p>CEP {detalhes.endereco.cep}</p></article>}
        <article className="card-compra"><h2>Rastreio</h2>{!detalhes?<p role="status">Carregando rastreio…</p>:!detalhes.envios.length?<p>O rastreio aparecerá aqui quando a loja informar a postagem.</p>:detalhes.envios.map(e=><div key={e.id}><p>{e.servico.toUpperCase()} · {rotuloStatus(e.status)}</p>{e.codigo_rastreio&&<p>Código: <b>{e.codigo_rastreio}</b></p>}<ol className="eventos-compra">{detalhes.eventos.filter(ev=>ev.envio_id===e.id).map(ev=><li key={ev.id}><b>{ev.descricao}</b><small>{dataLocal(ev.data_evento)}{ev.cidade?` · ${ev.cidade}/${ev.uf??''}`:''}</small></li>)}</ol></div>)}</article>
      </div>
    </>:carregando?<p role="status">Carregando pedidos…</p>:pedidos.length===0?<div className="card-compra"><h2>{admin?'Nenhum pedido cadastrado':'Você ainda não tem compras nesta conta'}</h2><p>{admin?'Os pedidos cadastrados aparecerão aqui.':'Quando uma compra for vinculada à sua conta pela loja, ela aparecerá aqui.'}</p>{!admin&&<a className="btn btn-p" href="/#/loja">Ver coleção</a>}</div>:<div className="lista-compras">{pedidos.map(p=><button className="linha-compra" key={p.id} onClick={()=>setPedido(p)}><div><b>{p.numero}</b><small>{dataLocal(p.criado_em)}</small><span className="pill">{rotuloStatus(p.status_pedido)} · {rotuloStatus(p.status_envio)}</span></div><div><strong>{moeda(p.total)}</strong><small>Ver detalhes ›</small></div></button>)}</div>}
  </section>;
}
