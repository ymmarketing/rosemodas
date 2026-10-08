import { useCallback, useEffect, useState } from 'react';
import { Acesso } from './Acesso';
import { EditorPeca } from './EditorPeca';
import { clienteInterno, operar, pendenciasDaPeca } from './catalogoInterno';
import type { ListaInterna, PecaInterna } from './catalogoInterno';
import { urlDaMidia } from '../catalogo';
import { moeda } from '../Visual';
import './painel.css';
import {ConciliacoesClientes} from './ConciliacoesClientes';
import { Pedidos } from '../cliente/Pedidos';

export function Painel() {
  const [aba,setAba]=useState<'catalogo'|'pedidos'|'clientes'>('catalogo');
  const homologacao=import.meta.env.VITE_APP_ENV==='homologation';
  const vitrine=homologacao?'https://homolog.rosemenezesmodas.com.br/':'https://rosemenezesmodas.com.br/';
  const [autorizado,setAutorizado]=useState(false),[lista,setLista]=useState<ListaInterna|null>(null),[editando,setEditando]=useState<PecaInterna|null>(null);
  const [busca,setBusca]=useState(''),[status,setStatus]=useState(''),[pagina,setPagina]=useState(0);
  const [carregando,setCarregando]=useState(false),[erro,setErro]=useState(''),[revisao,setRevisao]=useState(0);
  const entrou=useCallback(()=>setAutorizado(true),[]);
  useEffect(()=>{
    const {data}=clienteInterno().auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){setAutorizado(false);setLista(null);setEditando(null);}});
    return()=>data.subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!autorizado)return;
    let vivo=true;setCarregando(true);setErro('');
    operar<ListaInterna>('listar',null,{busca,status,pagina}).then(d=>{if(vivo)setLista(d);}).catch(e=>{if(vivo)setErro(e.message);}).finally(()=>{if(vivo)setCarregando(false);});
    return()=>{vivo=false;};
  },[autorizado,busca,status,pagina,revisao]);
  async function novaPeca(){setCarregando(true);setErro('');try{const p=await operar<PecaInterna>('criar',crypto.randomUUID());setEditando(p);setRevisao(n=>n+1);}catch(e){setErro(e instanceof Error?e.message:'Não foi possível criar a peça.');}finally{setCarregando(false);}}
  if(!autorizado)return <Acesso onReady={entrou}/>;
  return <div className="painel-app"><aside className="painel-nav">
    <a className="painel-marca" href={vitrine} target="_blank" rel="noreferrer"><img src="/marca/rose-menezes.jpg" alt=""/><span>Rose Menezes<small>PAINEL INTERNO</small></span></a>
    <span className="eyebrow">GESTÃO</span><button className={aba==='catalogo'?'nav-ativo':''} onClick={()=>{setEditando(null);setAba('catalogo');}}>Peças e estoque</button><button className={aba==='pedidos'?'nav-ativo':''} onClick={()=>setAba('pedidos')}>Pedidos</button><button className={aba==='clientes'?'nav-ativo':''} onClick={()=>setAba('clientes')}>Vínculos de clientes</button>
    <a href={vitrine} target="_blank" rel="noreferrer">Abrir vitrine ↗</a>
    <div className="nav-base"><span className="pill">{homologacao?'Homologação':'Rose Menezes'}</span><button className="btn btn-s btn-block" onClick={()=>clienteInterno().auth.signOut()}>Sair do painel</button></div>
  </aside><main className="painel-conteudo">
    {homologacao&&<div className="painel-aviso">PREVIEW PROTEGIDO · Este painel utiliza o banco de produção. Publicar uma peça altera o catálogo real.</div>}
    {erro&&<div className="painel-erro" role="alert">{erro}<button className="btn btn-s btn-sm" onClick={()=>setRevisao(n=>n+1)}>Tentar novamente</button></div>}
    {aba==='clientes'?<ConciliacoesClientes/>:aba==='pedidos'?<Pedidos sb={clienteInterno()} admin/>:editando&&lista?<EditorPeca key={editando.id} inicial={editando} lista={lista} fechar={()=>{setEditando(null);setRevisao(n=>n+1);}} salvou={p=>{setEditando(p);setLista(l=>l?{...l,itens:l.itens.map(x=>x.id===p.id?p:x)}:null);}}/>
      :<><div className="painel-cabecalho"><div><span className="eyebrow">CATÁLOGO</span><h1>Peças e estoque</h1><p>Comece pelas fotos. Revise os dados e publique quando estiver pronta.</p></div><button className="btn btn-p" disabled={carregando||!lista} onClick={novaPeca}>+ Nova peça</button></div>
        <div className="painel-filtros"><label>Buscar peça<input className="input" type="search" value={busca} placeholder="Nome ou código" onChange={e=>{setBusca(e.target.value);setPagina(0);}}/></label>
          <label>Situação<select className="input" value={status} onChange={e=>{setStatus(e.target.value);setPagina(0);}}><option value="">Todas</option><option value="rascunho">Rascunhos</option><option value="publicado">Publicadas</option></select></label><span>{lista?.total??0} peça(s)</span></div>
        {carregando&&<p role="status">Carregando catálogo…</p>}
        {!carregando&&lista?.itens.length===0&&<div className="painel-vazio"><h2>{busca||status?'Nenhuma peça encontrada':'Seu catálogo começa aqui'}</h2><p>{busca||status?'Altere os filtros para encontrar a peça.':'Crie a primeira peça e envie as fotos. Os demais dados podem ser preenchidos depois.'}</p>{(busca||status)&&<button className="btn btn-s" onClick={()=>{setBusca('');setStatus('');setPagina(0);}}>Limpar filtros</button>}</div>}
        <div className="grade-interna">{lista?.itens.map(p=>{const capa=p.midias.find(m=>m.principal&&m.ativo&&m.tipo==='foto'),faltas=pendenciasDaPeca(p);return <button className="card-peca-interna" key={p.id} onClick={()=>setEditando(p)}>
          <div className="foto-interna">{capa?<img src={urlDaMidia(capa.caminho_storage)??undefined} alt={capa.alt_texto} loading="lazy"/>:<span>Adicionar foto</span>}</div>
          <div className="card-peca-info"><span className={`pill ${p.ativo?'publicada':''}`}>{p.status_catalogo==='rascunho'?'Rascunho':p.ativo?'Na vitrine':'Fora da vitrine'}</span><small>{p.codigo}</small><h3>{p.nome??p.nome_sugerido??'Peça para revisar'}</h3><p>{p.preco!==null?moeda(p.preco_promocional??p.preco):'Preço a definir'}</p><span className="small muted">{faltas.length?`Revisar: ${faltas.join(', ')}`:`${p.variacoes.reduce((n,v)=>n+(v.ativo?Number(v.quantidade):0),0)} unidade(s) cadastrada(s)`}</span><b className="editar-peca">Revisar peça →</b></div></button>;})}</div>
        {lista&&lista.total>48&&<nav className="painel-paginacao" aria-label="Páginas do catálogo"><button className="btn btn-s" disabled={pagina===0||carregando} onClick={()=>setPagina(n=>n-1)}>Anterior</button><span>Página {pagina+1} de {Math.ceil(lista.total/48)}</span><button className="btn btn-s" disabled={(pagina+1)*48>=lista.total||carregando} onClick={()=>setPagina(n=>n+1)}>Próxima</button></nav>}
      </>}
  </main></div>;
}
