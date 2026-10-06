import { useState } from 'react';
import { precoAtual, tamanhosDoProduto, urlDaMidia } from './catalogo';
import type { Catalogo, Produto } from './catalogo';
import { Arte, classeSelo, demoDaPeca, Icone, moeda, selos } from './Visual';
export function PaginaProduto({ produto: p, catalogo, aviso, whatsapp, aviseMe, relacionados }: {
  produto: Produto; catalogo: Catalogo; aviso: (s: string) => void; whatsapp: (s: string) => void;
  aviseMe: (p: Produto, tamanho?: string) => void; relacionados: React.ReactNode;
}) {
  const saldos = catalogo.saldos.filter(v => v.produto_id === p.id);
  const cores = [...new Set([
    ...(p.variacoes ?? []).slice().sort((a,b) => a.sku.localeCompare(b.sku)).map(v => v.cor),
    ...saldos.map(v => v.cor),
  ])].filter(c => saldos.some(v => v.cor === c));
  const [cor, setCor] = useState(cores[0] ?? ''), [tamanho, setTamanho] = useState(''), [imagem, setImagem] = useState(0);
  const [videoAberto, setVideoAberto] = useState(false), [fotoFalhou, setFotoFalhou] = useState<string|null>(null);
  const [cep, setCep] = useState(''), [frete, setFrete] = useState(false);
  const tamanhos = tamanhosDoProduto(saldos, p.id).map(t => t.tamanho);
  const saldo = (t: string) => saldos.filter(v => v.cor === cor && v.tamanho === t).reduce((n,v) => n + v.disponivel,0);
  const total = saldos.reduce((n,v) => n + v.disponivel,0), preco = precoAtual(p), demo = demoDaPeca(p);
  const tamMedidas = tamanho || p.modelo_veste || tamanhos[0];
  const medidas = (catalogo.medidas ?? []).filter(m => m.produto_id === p.id && m.tamanho === tamMedidas).sort((a,b) => a.ordem - b.ordem);
  const fotos = [...p.midias].filter(m => m.tipo === 'foto').sort((a,b) => Number(b.principal)-Number(a.principal) || a.ordem-b.ordem);
  const video = p.midias.find(m => m.tipo === 'video'), midia = imagem < fotos.length ? fotos[imagem] : null;
  const categoria = catalogo.categorias.find(c => c.id === p.categoria_id);
  function comprar() {
    if (!total) { aviseMe(p); return; }
    if (!tamanho) { aviso('Escolha o tamanho primeiro'); return; }
    if (!saldo(tamanho)) { aviso('Esse tamanho está esgotado nessa cor.'); return; }
    aviso('A sacola e o checkout pertencem à Fase 1. Nesta homologação nenhuma compra é realizada.');
  }
  return <div className="s-wrap">
    <div className="s-crumb"><a href="#/loja">Coleção</a> › <a href={`#/loja?categoria=${categoria?.slug ?? ''}`}>{categoria?.nome}</a> › {p.nome}</div>
    <div className="pdp"><div className="gal"><div className="main">
      {videoAberto && video ? <video controls src={urlDaMidia(video.caminho_storage) ?? undefined} aria-label={video.alt_texto} />
        : midia && fotoFalhou !== midia.caminho_storage ? <img src={urlDaMidia(midia.caminho_storage) ?? undefined} alt={midia.alt_texto} onError={() => setFotoFalhou(midia.caminho_storage)} /> : <Arte produto={p} cor={cor} variante={imagem} />}
    </div><div className="th">{Array.from({length:Math.max(3,fotos.length)},(_,i) => <button key={i} className={!videoAberto&&imagem===i?'on':''} aria-label={`Imagem ${i+1} de ${p.nome}`} onClick={() => {setImagem(i);setVideoAberto(false);}}>
      {fotos[i] ? <img src={urlDaMidia(fotos[i].caminho_storage) ?? undefined} alt={fotos[i].alt_texto} /> : <Arte produto={p} cor={cor} variante={i} />}</button>)}
      <button className={`video-thumb ${videoAberto?'on':''}`} onClick={() => video ? setVideoAberto(true) : aviso('Vídeo da Rose vestindo a peça: mídia ainda não cadastrada.')}>▶ vídeo</button></div></div>
      <div className="pinfo">{p.selo && <span className={`pill ${classeSelo(p)}`}>{selos[p.selo]}</span>}
        <h1 style={{marginTop:8}}>{p.nome}</h1><div className="code">CÓD. {demo?.id ?? p.codigo} · {categoria?.nome.toUpperCase()}</div>
        <div className="price">{p.preco_promocional !== null && <s style={{fontSize:16,color:'var(--taupe)',fontFamily:'var(--sans)',marginRight:8}}>{moeda(p.preco)}</s>}{moeda(preco)}</div>
        <div className="parc">ou 3x de {moeda(preco/3)} sem juros · 5% off no Pix: {moeda(preco*.95)}</div>
        <div className="blk"><h5>Cor <span style={{textTransform:'none',letterSpacing:0,color:'var(--tinta)'}}>{cor}</span></h5><div className="cores">{cores.map(c => {
          const hex = (demo?.cores as readonly {n:string;hex:string}[] | undefined)?.find(x => x.n === c)?.hex ?? '#C99A9A';
          return <button key={c} className={cor===c?'on':''} style={{background:hex}} title={c} aria-label={`Cor ${c}`} aria-pressed={cor===c} onClick={() => {setCor(c);setTamanho('');}} />;
        })}</div></div>
        <div className="blk"><h5>Tamanho <a className="small" style={{textTransform:'none',letterSpacing:0,color:'var(--vinho)'}} href="#medidas" onClick={e => {e.preventDefault();document.getElementById('medidas')?.scrollIntoView({behavior:'smooth'});}}>Ver medidas</a></h5>
          <div className="sizes">{tamanhos.map(t => <button key={t} className={`${tamanho===t?'on':''} ${saldo(t)?'':'off'}`} aria-label={`Tamanho ${t}${saldo(t)?'':' esgotado'}`} aria-pressed={tamanho===t} onClick={() => saldo(t) ? setTamanho(t) : aviseMe(p,t)}>{t}{saldo(t)===1 && <span className="lt">última</span>}</button>)}</div>
          {p.modelo_veste && <div className="veste">A Rose veste <b>{p.modelo_veste}</b>{demo && ' e tem 1,62 m. Ficou soltinho na medida certa.'}</div>}</div>
        <div className="buy"><button className="btn btn-p btn-block" onClick={comprar}>{total?'Adicionar à sacola':'Avise-me quando chegar'}</button>
          <button className="btn btn-g btn-block" onClick={() => whatsapp(`Oi Rose! Quero tirar uma dúvida sobre o ${p.nome} (${p.codigo})${tamanho?`, tamanho ${tamanho}, cor ${cor}`:''}.`)}><Icone nome="wa" /> Tirar dúvida no WhatsApp</button></div>
        <div className="blk" id="medidas"><h5>Medidas da peça · tamanho {tamMedidas}</h5>{medidas.length ? <table className="meas"><tbody>{medidas.map(m => <tr key={m.medida}><td>{m.rotulo}</td><td>{m.valor_cm} cm</td></tr>)}</tbody></table> : <p className="small muted">Medidas ainda não cadastradas para este tamanho.</p>}
          <p className="xs muted" style={{marginTop:6}}>Medidas da peça deitada, de costura a costura. Entre dois tamanhos? Fale com a gente.</p></div>
        <div className="blk"><h5>Calcular frete</h5><form className="frete" onSubmit={e => {e.preventDefault();if(!/^\d{8}$/.test(cep.replace(/\D/g,''))){aviso('Digite um CEP com 8 números');return;}setFrete(true);aviso('Frete demonstrativo de homologação. Nenhuma cotação real dos Correios foi realizada.');}}>
          <input className="input" aria-label="Seu CEP" placeholder="Seu CEP" value={cep} onChange={e => {setCep(e.target.value);setFrete(false);}} maxLength={9} inputMode="numeric" /><button className="btn btn-s btn-sm">Calcular</button></form>
          {frete && <div className="frete-res"><div><span>PAC · 6 a 8 dias úteis</span><b>{moeda(22.9)}</b></div><div><span>SEDEX · 2 a 3 dias úteis</span><b>{moeda(38.4)}</b></div><span className="xs muted">Simulação de homologação. Frete grátis acima de R$ 299. Prazo conta a partir da postagem.</span></div>}</div>
        <div className="blk"><h5>Sobre a peça</h5><p className="small" style={{color:'var(--tinta)'}}>{p.descricao || 'Descrição ainda não cadastrada.'}</p></div>
      </div></div>
    {demo && <section className="revs"><h2 style={{fontSize:24}}>O que as clientes dizem <span className="stars" style={{fontSize:15}}>★★★★★</span> <span className="small muted" style={{fontFamily:'var(--sans)'}}>4,9 · 12 avaliações</span></h2>
      <div className="rev"><div className="stars">★★★★★</div><p style={{margin:'6px 0'}}>Comprei o 48 e serviu perfeito. Tecido que não amassa, usei no aniversário da minha filha e recebi muito elogio.</p><span className="xs muted">Márcia A. · veste 48 · comprou na live</span></div>
      <div className="rev"><div className="stars">★★★★★</div><p style={{margin:'6px 0'}}>Finalmente uma loja que mostra as medidas de verdade. Chegou rapidinho em Betim.</p><span className="xs muted">Sônia L. · veste 52</span></div></section>}
    <h2 style={{fontSize:24,margin:'40px 0 14px'}}>Combina com</h2><div className="s-grid">{relacionados}</div>
  </div>;
}
