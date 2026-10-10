import { useState } from 'react';
import { precoAtual, tamanhosDoProduto } from './catalogo';
import type { Catalogo, Produto } from './catalogo';
import { classeSelo, demoDaPeca, Icone, moeda, selos } from './Visual';
import { mensagemCompraWhatsApp, mensagemEncomendaWhatsApp } from './compraWhatsApp';
import { GaleriaProduto } from './GaleriaProduto';
import type { useNavegacaoLoja } from './navegacaoLoja';
import {CalculadoraFrete} from './CalculadoraFrete';
import {trechoFreteWhatsApp} from './frete';
import type {FreteEscolhido} from './frete';
export function PaginaProduto({ produto: p, catalogo, aviso, whatsapp, relacionados, homologacao, navegacao }: {
  produto: Produto; catalogo: Catalogo; aviso: (s: string) => void; whatsapp: (s: string) => void;
  relacionados: React.ReactNode; homologacao: boolean; navegacao?: ReturnType<typeof useNavegacaoLoja>;
}) {
  const saldos = catalogo.saldos.filter(v => v.produto_id === p.id);
  const cores = [...new Set([
    ...(p.variacoes ?? []).slice().sort((a,b) => a.sku.localeCompare(b.sku)).map(v => v.cor),
    ...saldos.map(v => v.cor),
  ])].filter(c => saldos.some(v => v.cor === c));
  const unica=saldos.length===1?saldos[0]:undefined;
  const coresDisponiveis=cores.filter(c=>saldos.some(v=>v.cor===c&&v.disponivel>0));
  const [cor, setCor] = useState(unica?.cor ?? (cores.length===1?cores[0]:coresDisponiveis.length===1?coresDisponiveis[0]:'')), [tamanho, setTamanho] = useState(unica?.tamanho??'');
  const tamanhos = tamanhosDoProduto(saldos, p.id).map(t => t.tamanho);
  const saldo = (t: string) => saldos.filter(v => v.cor === cor && v.tamanho === t).reduce((n,v) => n + v.disponivel,0);
  const total = saldos.reduce((n,v) => n + v.disponivel,0), preco = precoAtual(p), demo = demoDaPeca(p);
  const tamMedidas = tamanho || p.modelo_veste || tamanhos[0];
  const medidas = (catalogo.medidas ?? []).filter(m => m.produto_id === p.id && m.tamanho === tamMedidas).sort((a,b) => a.ordem - b.ordem);
  const fotos = [...p.midias].filter(m => m.tipo === 'foto').sort((a,b) => Number(b.principal)-Number(a.principal) || a.ordem-b.ordem);
  const video = p.midias.find(m => m.tipo === 'video');
  const combinacao=saldos.find(v=>v.cor===cor&&v.tamanho===tamanho);
  const [frete,setFrete]=useState<FreteEscolhido|null>(null);
  const encomendar=total===0||combinacao?.disponivel===0;
  const categoria = catalogo.categorias.find(c => c.id === p.categoria_id);
  function comprar() {
    try {
      if(encomendar){
        if(tamanhos.some(t=>t.trim())&&!tamanho.trim())throw new Error('Escolha o tamanho primeiro.');
        if(cores.some(c=>c.trim())&&!cor.trim())throw new Error('Escolha uma cor primeiro.');
        whatsapp(mensagemEncomendaWhatsApp(p,tamanho,window.location.href)+trechoFreteWhatsApp(frete));
      } else whatsapp(mensagemCompraWhatsApp(p,saldos,cor,tamanho,window.location.href)+trechoFreteWhatsApp(frete));
    } catch (e) { aviso(e instanceof Error ? e.message : 'Não foi possível preparar a mensagem pelo WhatsApp.'); }
  }
  return <div className="s-wrap">
    <div className="s-crumb"><a href="#/loja">Coleção</a> › {categoria&&<><a href={`#/loja?categoria=${categoria.slug}`}>{categoria.nome}</a> › </>}{p.nome}</div>
    <div className="pdp"><GaleriaProduto fotos={fotos} video={video} nome={p.nome} slug={p.slug} esgotada={total===0} navegacao={navegacao}/>
      <div className="pinfo">{total===0&&<span className="pill selo-esgotado-info">Esgotado · Encomende</span>}{p.selo && p.selo!=='aprovado_rose' && <span className={`pill ${classeSelo(p)}`}>{selos[p.selo]}</span>}
        <h1 style={{marginTop:8}}>{p.nome}</h1><div className="code">CÓD. {p.codigo}{categoria&&` · ${categoria.nome.toUpperCase()}`}</div>
        <div className="price">{p.preco_promocional !== null && <s style={{fontSize:16,color:'var(--taupe)',fontFamily:'var(--sans)',marginRight:8}}>{moeda(p.preco)}</s>}{moeda(preco)}</div>
        {cores.some(c=>c.trim())&&<div className="blk"><h5>Cor <span style={{textTransform:'none',letterSpacing:0,color:'var(--tinta)'}}>{cor}</span></h5><div className="cores">{cores.map(c => {
          const hex = (demo?.cores as readonly {n:string;hex:string}[] | undefined)?.find(x => x.n === c)?.hex ?? '#C99A9A';
          return <button key={c} className={cor===c?'on':''} style={{background:hex}} title={c} aria-label={`Cor ${c}`} aria-pressed={cor===c} onClick={() => {setCor(c);const ds=saldos.filter(v=>v.cor===c);setTamanho(ds.length===1?ds[0].tamanho:'');}} />;
        })}</div></div>}
        {tamanhos.some(t=>t.trim())&&<div className="blk"><h5>Tamanho {medidas.length>0&&<a className="small" style={{textTransform:'none',letterSpacing:0,color:'var(--vinho)'}} href="#medidas" onClick={e => {e.preventDefault();document.getElementById('medidas')?.scrollIntoView({behavior:'smooth'});}}>Ver medidas</a>}</h5>
          <div className="sizes">{tamanhos.filter(t=>t.trim()).map(t => t==='Tamanho único'&&tamanhos.filter(t=>t.trim()).length===1?<span key={t} className="small">Tamanho único</span>:<button key={t} className={`${tamanho===t?'on':''} ${saldo(t)?'':'off'}`} aria-label={`Tamanho ${t}${saldo(t)?'':' esgotado'}`} aria-pressed={tamanho===t} onClick={() => setTamanho(t)}>{t}{!saldo(t)&&<span className="tamanho-esgotado">Esgotado</span>}{saldo(t)===1 && <span className="lt">última</span>}</button>)}</div>
          {p.modelo_veste && <div className="veste">A Rose veste <b>{p.modelo_veste}</b></div>}</div>}
        <div className="buy"><button className="btn btn-p btn-block" onClick={comprar}>{encomendar?'Encomendar pelo WhatsApp':'Comprar pelo WhatsApp'}</button>
          <button className="btn btn-g btn-block" onClick={() => whatsapp(`Oi Rose! Quero tirar uma dúvida sobre o ${p.nome} (${p.codigo})${cor.trim()?`, cor ${cor}`:''}${tamanho.trim()?`, tamanho ${tamanho}`:''}.`)}><Icone nome="wa" /> Tirar dúvida no WhatsApp</button></div>
        {medidas.length>0&&<div className="blk" id="medidas"><h5>Medidas da peça{tamMedidas&&` · ${tamMedidas}`}</h5><table className="meas"><tbody>{medidas.map(m=><tr key={m.medida}><td>{m.rotulo}</td><td>{m.valor_cm} cm</td></tr>)}</tbody></table></div>}
        <CalculadoraFrete codigo={p.codigo} variacao={combinacao?.variacao_id??null} escolheu={setFrete} consultar={()=>whatsapp(`Oi Rose! Quero consultar frete e prazo para ${p.nome} (${p.codigo}).`)}/>
        {p.descricao&&<div className="blk"><h5>Sobre a peça</h5><p className="small" style={{color:'var(--tinta)'}}>{p.descricao}</p></div>}
      </div></div>
    <h2 style={{fontSize:24,margin:'40px 0 14px'}}>Combina com</h2><div className="s-grid">{relacionados}</div>
  </div>;
}
