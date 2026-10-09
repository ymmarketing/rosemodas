import { painelUrl } from './painel/catalogoInterno';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { buscaDosFiltros, carregarCatalogo, categoriasDisponiveis, filtrosIniciais, lerFiltros, linkWhatsApp, precoAtual, selecionarProdutos, tamanhosDoProduto } from './catalogo';
import type { Catalogo, Filtros, Produto } from './catalogo';
import { Arte, classeSelo, Icone, Marca, moeda, selos } from './Visual';
import { PaginaProduto } from './Produto';
import { QuemSomos, Trocas } from './Institucional';
import { recursosDeHomologacao } from './ambiente';

type Janela = 'menu' | 'busca' | 'guia' | 'privacidade' | 'whatsapp' | 'fase1' | 'fase2' | null;
const lerRota = () => window.location.hash.replace(/^#\/?/,'').split('?')[0] || 'loja';
const lerBusca = () => window.location.hash.includes('?') ? window.location.hash.split('?')[1] : window.location.search;
function carregarFavoritos() {try {const p:unknown=JSON.parse(localStorage.getItem('rose-favoritos') ?? '[]');return new Set(Array.isArray(p)?p.filter((s):s is string=>typeof s==='string'):[]);}catch{return new Set<string>();}}
function Dialogo({titulo,fechar,children,drawer=false}:{titulo:string;fechar:()=>void;children:ReactNode;drawer?:boolean}) {
 const caixa=useRef<HTMLDivElement>(null);
 useEffect(() => {const anterior=document.activeElement as HTMLElement|null;caixa.current?.querySelector<HTMLElement>('button,input,select,a')?.focus();
 const tecla=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();fechar();}if(e.key==='Tab'){
 const itens=Array.from(caixa.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]')??[]);const a=itens[0],b=itens.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b?.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a?.focus();}}};
 const overflow=document.body.style.overflow;document.body.style.overflow='hidden';document.addEventListener('keydown',tecla);return()=>{document.removeEventListener('keydown',tecla);document.body.style.overflow=overflow;anterior?.focus();};},[fechar]);
 return <div className={drawer?'drawer-bg':'mbg'} style={drawer?{justifyContent:'flex-start'}:undefined} onClick={e=>{if(e.target===e.currentTarget)fechar();}}>
 <div ref={caixa} className={drawer?'drawer':'modal'} role="dialog" aria-modal="true" aria-label={titulo}><div className="mh"><h3>{titulo}</h3><button type="button" onClick={fechar} aria-label="Fechar" style={{fontSize:22,color:'var(--taupe)'}}>×</button></div><div className="mb">{children}</div></div></div>;
}
export function Loja({homologacao=recursosDeHomologacao(import.meta.env?.VITE_APP_ENV)}:{homologacao?:boolean}={}) {
 const [catalogo,setCatalogo]=useState<Catalogo|null>(null),[estado,setEstado]=useState<'carregando'|'pronto'|'erro'>('carregando'),[tentativa,setTentativa]=useState(0);
 const [agora,setAgora]=useState(Date.now);
 const demonstracao=false;
 useEffect(()=>{const timer=setTimeout(()=>setAgora(Date.now()),Math.max(0,Date.parse('2026-10-09T21:00:00Z')-Date.now()));return()=>clearTimeout(timer);},[]);
 const [rota,setRota]=useState(lerRota),[filtros,setFiltros]=useState(()=>lerFiltros(lerBusca()));
 useEffect(()=>{if(new URLSearchParams(lerBusca()).get('colecao')==='hom-lancamento'){const q=new URLSearchParams(lerBusca());q.set('colecao','lancamento');const hash=window.location.hash.split('?')[0]||'#/loja';window.history.replaceState(null,'',`${window.location.pathname}?${q}${hash}`);}},[rota]);
 const [janela,setJanela]=useState<Janela>(null),[favoritos,setFavoritos]=useState(carregarFavoritos),[textoBusca,setTextoBusca]=useState('');
 const [toast,setToast]=useState(''),toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{let ativo=true,ocupado=false;const controles=new Set<AbortController>();
 async function renovar(){if(ocupado)return;ocupado=true;const controle=new AbortController();controles.add(controle);const timer=setTimeout(()=>controle.abort(),15000);
 try{const c=await carregarCatalogo(controle.signal);if(ativo){setCatalogo(c);setAgora(Date.now());setEstado('pronto');}}
 catch{if(ativo)setEstado(anterior=>anterior==='pronto'?'pronto':'erro');}
 finally{ocupado=false;clearTimeout(timer);controles.delete(controle);}}
 void renovar();const intervalo=setInterval(()=>{if(document.visibilityState!=='hidden')void renovar();},30000);
 const foco=()=>void renovar();window.addEventListener('focus',foco);
 return()=>{ativo=false;clearInterval(intervalo);window.removeEventListener('focus',foco);for(const c of controles)c.abort();};},[tentativa]);
 useEffect(()=>{const navegar=()=>{setRota(lerRota());setFiltros(lerFiltros(lerBusca()));setJanela(null);window.scrollTo(0,0);};window.addEventListener('hashchange',navegar);window.addEventListener('popstate',navegar);return()=>{window.removeEventListener('hashchange',navegar);window.removeEventListener('popstate',navegar);};},[]);
 useEffect(()=>()=>{if(toastTimer.current)clearTimeout(toastTimer.current);},[]);
 useEffect(()=>{try{localStorage.setItem('rose-favoritos',JSON.stringify([...favoritos]));}catch{}},[favoritos]);
 const fechar=useCallback(()=>setJanela(null),[]);
 function aviso(s:string){setToast(s);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4000);}
 function whatsapp(mensagem='Oi Rose! Quero conhecer a coleção.') {const url=linkWhatsApp('5531975417483',mensagem);if(!url){setJanela('whatsapp');return false;}window.open(url,'_blank','noopener,noreferrer');return true;}
 function instagram(){window.open('https://www.instagram.com/rosemenezes_modas/','_blank','noopener,noreferrer');}
 function ir(e:React.MouseEvent<HTMLAnchorElement>,destino:string){e.preventDefault();window.location.hash=destino;setRota(destino.replace(/^#\/?/,''));setJanela(null);window.scrollTo(0,0);}
 function atualizar(p:Partial<Filtros>){const f={...filtros,...p};setFiltros(f);setRota('loja');const b=buscaDosFiltros(f);window.history.pushState(null,'',`${window.location.pathname}${b?'?'+b:''}#/loja`);}
 function limpar(){setFiltros(filtrosIniciais);setTextoBusca('');window.history.pushState(null,'',`${window.location.pathname}#/loja`);}
 function favoritar(p:Produto){const novo=new Set(favoritos);if(novo.has(p.codigo)){novo.delete(p.codigo);aviso('Removida dos favoritos');}else{novo.add(p.codigo);aviso('Salva nos favoritos');}setFavoritos(novo);}
 const catalogoVisivel=catalogo?{...catalogo,produtos:catalogo.produtos.filter(p=>!p.dado_teste||agora<Date.parse('2026-10-09T21:00:00Z'))}:null;
 const categoriasVisiveis=catalogoVisivel?categoriasDisponiveis(catalogoVisivel):[];
 const acessoCliente=false;
 const lista=catalogoVisivel?selecionarProdutos(catalogoVisivel,{...filtros,tamanho:''}):[];
 const temFiltros=!!(filtros.categoria||filtros.tamanho||filtros.disponiveis||filtros.busca||filtros.ordem!=='novidades'||filtros.colecao!==null);
 const pRota=rota.startsWith('loja/produto/')?catalogoVisivel?.produtos.find(p=>p.slug===rota.split('/')[2]||p.codigo===rota.split('/')[2]):undefined;
 function cartao(p:Produto){if(!catalogo)return null;const tamanhos=tamanhosDoProduto(catalogo.saldos,p.id),esg=!tamanhos.some(t=>t.disponivel>0);return <div className="card" key={p.id} data-produto={p.codigo}>
 <a href={`#/loja/produto/${p.slug}`} className="im" aria-label={`Ver ${p.nome}`}><Arte produto={p}/>{p.selo&&p.selo!=='aprovado_rose'&&!esg&&<span className={`pill ${classeSelo(p)} sel`}>{selos[p.selo]}</span>}
 {esg&&<div className="esg"><span className="pill t-neu">Esgotado</span></div>}</a>
 <button className={`fav ${favoritos.has(p.codigo)?'on':''}`} onClick={()=>favoritar(p)} title="Favoritar" aria-label={`Favoritar ${p.nome}`} aria-pressed={favoritos.has(p.codigo)}><Icone nome="heart"/></button>
 <a href={`#/loja/produto/${p.slug}`}><div className="nm">{p.nome}</div><div className="pr">{p.preco_promocional!==null&&<s>{moeda(p.preco)}</s>}{moeda(precoAtual(p))}</div></a></div>;}
 const carregando=<div className="estado" role={estado==='erro'?'alert':'status'}>{estado==='erro'?<><h2>Não conseguimos carregar a coleção</h2><p className="muted">Confira sua conexão e tente novamente.</p><button className="btn btn-p" onClick={()=>setTentativa(t=>t+1)}>Tentar novamente</button></>:<p className="muted">Carregando a coleção…</p>}</div>;
 function home(){if(estado==='pronto'&&!catalogoVisivel?.produtos.length)return <section className="s-wrap estado"><span className="eyebrow">Rose Menezes</span><h1>Coleção chegando em breve</h1><p>Fale com a Rose para acompanhar o lançamento.</p><p className="small muted">Live quinta, 20h</p><a className="btn btn-p" href="https://wa.me/5531975417483" target="_blank" rel="noreferrer">Falar com a Rose pelo WhatsApp</a></section>;return <div className="s-wrap"><section className="s-hero"><div><span className="eyebrow">Coleção de lançamento · primavera</span><h1>Bonita do seu jeito, confortável o dia todo</h1><p>Peças do P ao Plus Size que vestem bem o corpo de verdade.</p>
 <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><a className="btn btn-p" href="#colecao" onClick={e=>{e.preventDefault();document.getElementById('colecao')?.scrollIntoView({behavior:'smooth'});}}>Ver coleção</a><a className="btn btn-s" href="#instagram" onClick={e=>{e.preventDefault();instagram();}}>Live quinta, 20h</a></div></div>
 <div className={`art ${catalogo?.hero?'destaque-oficial':''}`}>{catalogo?.hero?<picture><source media="(max-width:760px)" srcSet={catalogo.hero.mobile}/><img src={catalogo.hero.desktop} alt={catalogo.hero.alt} loading="eager" fetchPriority="high" decoding="async"/></picture>:lista[0]&&<Arte produto={lista[0]} variante={2} hero/>}</div></section>
 {estado!=='pronto'?carregando:<><div id="colecao" className="s-cats" role="group" aria-label="Categorias"><button className={`chip ${!filtros.categoria?'on':''}`} aria-pressed={!filtros.categoria} onClick={()=>atualizar({categoria:''})}>Todas</button>{categoriasVisiveis.map(c=><button key={c.id} className={`chip ${filtros.categoria===c.slug?'on':''}`} aria-pressed={filtros.categoria===c.slug} onClick={()=>atualizar({categoria:c.slug})}>{c.nome}</button>)}</div>
 <div className="s-bar"><span className="cnt" role="status" aria-live="polite">{lista.length} {lista.length===1?'peça':'peças'}</span>
 <label className="sr-only" htmlFor="ordem">Ordenar peças</label><select id="ordem" value={filtros.ordem} onChange={e=>atualizar({ordem:e.target.value as Filtros['ordem']})}><option value="novidades">Novidades</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select>
 <label className="small" style={{display:'flex',gap:6,alignItems:'center'}}><input type="checkbox" checked={filtros.disponiveis} onChange={e=>atualizar({disponiveis:e.target.checked})}/> Só disponíveis</label>{temFiltros&&<button className="limpar" onClick={limpar}>Limpar filtros</button>}</div>
 {filtros.busca&&<p className="resultado-busca">Resultado da busca por “{filtros.busca}”</p>}{lista.length?<div className="s-grid">{lista.map(cartao)}</div>:<div className="empty"><span className="script">Ops</span>{catalogo?.produtos.length?'Nenhuma peça com esse filtro.':'Coleção chegando em breve'} {!catalogo?.produtos.length&&<a className="btn btn-p" href="https://wa.me/5531975417483" target="_blank" rel="noreferrer">Falar com a Rose pelo WhatsApp</a>}{temFiltros&&<button className="lnk" style={{color:'var(--vinho)',fontWeight:600}} onClick={limpar}>Limpar filtros</button>}</div>}</>}
 </div>;}
 let conteudo:ReactNode;
 if(rota==='loja'||rota==='loja/inicio')conteudo=home();
 else if(rota==='loja/quem-somos')conteudo=<QuemSomos catalogo={catalogo} homologacao={demonstracao} whatsapp={()=>whatsapp()}/>;
 else if(rota==='loja/privacidade')conteudo=<section className="s-wrap"><h1>Política de privacidade</h1><p>A Rose Menezes usa as informações que você fornece pelo WhatsApp para atender compras e entregas.</p><p>O atendimento acontece pelo WhatsApp, iniciado por você. Favoritos ficam neste navegador.</p><p>Dados de pedidos são mantidos para atendimento e obrigações aplicáveis. Para consultar, corrigir ou solicitar exclusão de seus dados, fale com a Rose pelo WhatsApp. O pedido será analisado considerando os registros que precisam ser preservados.</p><p>O atendimento não autoriza mensagens de marketing automaticamente.</p><a className="btn btn-p" href="https://wa.me/5531975417483" target="_blank" rel="noreferrer">Falar sobre meus dados</a><p className="small muted">Versão de 08/10/2026.</p></section>;
 else if(rota==='loja/trocas')conteudo=<Trocas homologacao={demonstracao} aviso={()=>demonstracao?setJanela('fase1'):whatsapp('Oi Rose! Quero orientações sobre troca ou cancelamento.')}/>;
 else if(rota.startsWith('loja/produto/'))conteudo=estado!=='pronto'?carregando:pRota&&catalogo?<PaginaProduto key={pRota.id} produto={pRota} catalogo={catalogo} homologacao={demonstracao} aviso={aviso} whatsapp={whatsapp} relacionados={(catalogoVisivel?.produtos??[]).filter(p=>p.id!==pRota.id&&tamanhosDoProduto(catalogo.saldos,p.id).some(t=>t.disponivel)).slice(0,4).map(cartao)}/>:<div className="estado"><h1>Peça não encontrada</h1><a className="btn btn-p" href="#/loja">Voltar à coleção</a></div>;
 else conteudo=<div className="bloqueio"><h1>Página não encontrada</h1><a className="btn btn-p" href="#/loja">Voltar à coleção</a></div>;
 return <>{homologacao&&<div id="homolog"><b>HOMOLOGAÇÃO</b><a href="#/loja" className="on">Loja</a>{acessoCliente&&<a href="/#/cliente">Área da cliente</a>}<a href={painelUrl} target="_blank" rel="noreferrer">Painel interno</a><span className="sp"/><span style={{opacity:.6}}>catálogo em revisão · não realiza vendas</span></div>}
 <div className="s-top">Lançamento 10/10 · Atendimento pelo WhatsApp</div>
 <header className="s-head"><div className="in"><button className="s-menu-btn" style={{margin:0}} onClick={()=>setJanela('menu')} aria-label="Abrir menu"><span style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center'}}><Icone nome="menu"/></span></button>
 <a className="s-logo" href="#/loja"><Marca catalogo={catalogo}/></a><nav className="s-nav" aria-label="Principal"><a href="#/loja" className={rota==='loja'?'on':''}>Coleção</a><a href="#/loja/quem-somos" onClick={e=>ir(e,"#/loja/quem-somos")} className={rota==='loja/quem-somos'?'on':''}>Quem somos</a><a href="#/loja/trocas" onClick={e=>ir(e,"#/loja/trocas")} className={rota==='loja/trocas'?'on':''}>Trocas e cancelamentos</a></nav>
 <div className="s-ic"><button title="Buscar" aria-label="Buscar" onClick={()=>{setTextoBusca(filtros.busca??'');setJanela('busca');}}><Icone nome="search"/></button>{acessoCliente&&<a title="Área da cliente" aria-label="Área da cliente" href="/#/cliente"><Icone nome="user"/></a>}</div></div></header>
 <main>{conteudo}</main><footer className="s-foot"><div className="in"><div><div className="s-logo"><Marca catalogo={catalogo}/></div><p className="small" style={{marginTop:12,color:'var(--tinta)',maxWidth:320}}>Moda para a mulher real 35+, do P ao Plus Size. Peças escolhidas e vestidas pela própria Rose.</p><p className="script" style={{fontSize:28,marginTop:6}}>Elegância que abraça</p></div>
 <div><h4>Ajuda</h4><a href="#/loja/trocas" onClick={e=>ir(e,"#/loja/trocas")}>Trocas e cancelamentos</a>{acessoCliente&&<a href="/#/cliente">Acompanhar pedido</a>}<a href="#whatsapp" onClick={e=>{e.preventDefault();whatsapp();}}>Falar no WhatsApp</a></div>
 <div><h4>A loja</h4><a href="#/loja/quem-somos" onClick={e=>ir(e,"#/loja/quem-somos")}>Quem somos</a><a href="#instagram" onClick={e=>{e.preventDefault();instagram();}}>Instagram</a><a href="#/loja/privacidade" onClick={e=>ir(e,"#/loja/privacidade")}>Privacidade</a><a href={painelUrl} target="_blank" rel="noreferrer" style={{color:'var(--taupe)',fontSize:12,marginTop:8}}>Acesso interno</a></div></div>
 <div className="bot"><span>Rose Menezes Moda Feminina</span>{catalogo?.cnpj&&<span>CNPJ {catalogo.cnpj}</span>}</div></footer>
 <button className="wa-float" title="WhatsApp" aria-label="WhatsApp" onClick={()=>whatsapp()}><Icone nome="wa"/></button>
 {janela&&!['fase1','fase2'].includes(String(janela))&&<Dialogo titulo={janela==='menu'?'Menu':janela==='busca'?'Buscar uma peça':janela==='guia'?'Guia de medidas':janela==='privacidade'?'Privacidade':janela==='whatsapp'?'WhatsApp da Rose':'Próxima fase'} fechar={fechar} drawer={janela==='menu'}>
 {janela==='menu'&&<>{[['Coleção','#/loja'],['Quem somos','#/loja/quem-somos'],['Trocas e cancelamentos','#/loja/trocas']].map(([n,h])=><a key={h} href={h} onClick={e=>ir(e,h)} style={{display:'block',padding:'12px 0',borderBottom:'1px solid var(--linha)',fontSize:16}}>{n}</a>)}{acessoCliente&&<a className="btn btn-block" href="/#/cliente" onClick={fechar}>Área da cliente</a>}<p className="small muted" style={{marginTop:18}}>Categorias</p>{categoriasVisiveis.map(c=><button key={c.id} style={{display:'block',padding:'8px 0'}} onClick={()=>{atualizar({categoria:c.slug});fechar();}}>{c.nome}</button>)}</>}
 {janela==='busca'&&<form onSubmit={e=>{e.preventDefault();atualizar({...filtrosIniciais,busca:textoBusca.trim()});fechar();document.getElementById('colecao')?.scrollIntoView();}}><div className="field"><label htmlFor="buscar">Nome ou código da peça</label><input id="buscar" className="input" value={textoBusca} onChange={e=>setTextoBusca(e.target.value)} placeholder="Ex.: Aurora ou RM01"/></div><button className="btn btn-p btn-block">Buscar</button></form>}
 {janela==='whatsapp'&&<><p className="small">Os botões e mensagens estão preparados. O número comercial da Rose ainda precisa ser configurado para abrir a conversa correta.</p><p className="xs muted" style={{marginTop:12}}>Nenhuma mensagem foi enviada.</p></>}


 </Dialogo>}
 <div id="toast" className={toast?'on':''} role="status" aria-live="polite">{toast}</div></>;
}
