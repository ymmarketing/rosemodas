import { useEffect, useRef, useState } from 'react';
import type { Midia } from './catalogo';
import { urlDaMidia } from './catalogo';
import type { useNavegacaoLoja } from './navegacaoLoja';

type Navegacao = ReturnType<typeof useNavegacaoLoja>;
function Carrossel({ fotos, nome, indice, mudar, abrir, telaCheia = false, esgotada = false }: {
  fotos: Midia[]; nome: string; indice: number; mudar: (i: number) => void;
  abrir?: (i: number) => void; telaCheia?: boolean; esgotada?: boolean;
}) {
  const trilha = useRef<HTMLDivElement>(null), arraste = useRef<{ x: number; y: number; inicio: number; indice: number } | null>(null);
  const arrastou = useRef(false), sincronizando = useRef(false), origemScroll = useRef<number | null>(null);
  useEffect(() => {
    if (origemScroll.current===indice) { origemScroll.current=null;return; }
    const el = trilha.current;
    if (!el || Math.abs(el.scrollLeft - indice * el.clientWidth) < 2) return;
    sincronizando.current = true;
    el.scrollTo({ left: indice * el.clientWidth, behavior: 'smooth' });
    const fim = () => { sincronizando.current = false; };
    el.addEventListener('scrollend', fim, { once: true });
    const timer = setTimeout(fim, 600);
    return () => { clearTimeout(timer); el.removeEventListener('scrollend', fim); sincronizando.current = false; };
  }, [indice]);
  function ir(delta: number) { mudar(Math.max(0, Math.min(fotos.length - 1, indice + delta))); }
  return <div className={`carrossel ${telaCheia?'carrossel-tela':''}`} role="region" aria-label={`Fotos de ${nome}`} tabIndex={0}
    onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); ir(e.key === 'ArrowLeft' ? -1 : 1); } }}>
    <div ref={trilha} className="car-trilha" onScroll={e => {
      const el = e.currentTarget;
      if (el.clientWidth && !sincronizando.current) { const i=Math.round(el.scrollLeft / el.clientWidth);origemScroll.current=i;mudar(i); }
    }} onPointerDown={e => { arrastou.current = false; if (e.pointerType === 'mouse') arraste.current = { x: e.clientX, y: e.clientY, inicio: e.currentTarget.scrollLeft, indice }; }}
    onPointerMove={e => {
      const a = arraste.current;
      if (!a || Math.abs(e.clientX-a.x) < 8 || Math.abs(e.clientY-a.y) > Math.abs(e.clientX-a.x)) return;
      arrastou.current = true; e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.scrollLeft = a.inicio + a.x - e.clientX;
    }} onPointerUp={e => { if (arraste.current && arrastou.current) { const delta = e.clientX-arraste.current.x; mudar(Math.max(0,Math.min(fotos.length-1,arraste.current.indice+(delta < -40 ? 1 : delta > 40 ? -1 : 0)))); } arraste.current = null; }} onPointerCancel={() => { arraste.current = null; }}>
      {fotos.map((f, i) => <div className="car-slide" key={f.caminho_storage} aria-hidden={i!==indice}>
        {Math.abs(i-indice)<=1 && (abrir ? <button className={`car-foto ${esgotada?'foto-esgotada':''}`} tabIndex={i===indice?0:-1} aria-label={`Abrir foto ${i+1} de ${nome}`} onClick={() => { if (!arrastou.current) abrir(i); }}>
          <img src={urlDaMidia(f.caminho_storage)??undefined} alt={f.alt_texto||nome} loading={i===indice?'eager':'lazy'} draggable={false}/>
        </button> : <img className={esgotada?'foto-esgotada':''} src={urlDaMidia(f.caminho_storage)??undefined} alt={f.alt_texto||nome} loading={i===indice?'eager':'lazy'} draggable={false}/>)}
      </div>)}
    </div>
    {fotos.length>1&&<><button className="car-seta anterior" aria-label="Foto anterior" disabled={indice===0} onClick={()=>ir(-1)}>‹</button><button className="car-seta proxima" aria-label="Próxima foto" disabled={indice===fotos.length-1} onClick={()=>ir(1)}>›</button></>}
  </div>;
}
export function GaleriaProduto({ fotos, video, nome, slug, esgotada, navegacao }: {
  fotos: Midia[]; video?: Midia; nome: string; slug: string; esgotada: boolean; navegacao?: Navegacao;
}) {
  const [indice, setIndice] = useState(0), [videoAberto, setVideoAberto] = useState(false);
  const dialogo = useRef<HTMLDivElement>(null);
  const aberta = navegacao?.foto?.slug===slug;
  const fotoAberta = Math.min(navegacao?.foto?.indice??0, fotos.length-1);
  const atual = useRef({ navegacao, fotoAberta });atual.current={navegacao,fotoAberta};
  useEffect(() => {
    if (!aberta || !navegacao) return;
    const anterior = document.activeElement as HTMLElement|null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogo.current?.querySelector<HTMLButtonElement>('.foto-fechar')?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => {
      if (e.key==='Escape') { e.preventDefault(); navegacao.fecharFoto(); }
      if (e.key==='ArrowLeft'||e.key==='ArrowRight') { e.preventDefault(); e.stopPropagation(); atual.current.navegacao?.mudarFoto(Math.max(0,Math.min(fotos.length-1,atual.current.fotoAberta+(e.key==='ArrowLeft'?-1:1)))); }
      if (e.key==='Tab') { const itens=Array.from(dialogo.current?.querySelectorAll<HTMLElement>('button:not([disabled]),[tabindex="0"]')??[]); if (e.shiftKey&&document.activeElement===itens[0]) {e.preventDefault();itens.at(-1)?.focus();} else if (!e.shiftKey&&document.activeElement===itens.at(-1)) {e.preventDefault();itens[0]?.focus();} }
    };
    document.addEventListener('keydown', tecla, true);
    return () => { document.body.style.overflow=overflow;document.removeEventListener('keydown',tecla,true);anterior?.focus({preventScroll:true}); };
  }, [aberta, fotos.length]);
  function mudar(i: number) { setIndice(i);setVideoAberto(false); }
  return <div className="gal">
    <div className="main">{videoAberto&&video?<video controls src={urlDaMidia(video.caminho_storage)??undefined} aria-label={video.alt_texto}/>:fotos.length?<Carrossel fotos={fotos} nome={nome} indice={indice} mudar={mudar} esgotada={esgotada} abrir={i=>navegacao?.abrirFoto(slug,i)}/>:<div className="sem-foto">Foto indisponível</div>}
      {esgotada&&!videoAberto&&<span className="pill selo-esgotado">Esgotado</span>}
    </div>
    {fotos.length>1&&<div className="car-bolinhas" aria-label="Posição da foto">{fotos.map((f,i)=><button key={f.caminho_storage} aria-label={`Mostrar foto ${i+1}`} aria-pressed={!videoAberto&&indice===i} onClick={()=>mudar(i)}/>)}</div>}
    <div className="th">{fotos.map((f,i)=><button key={f.caminho_storage} className={!videoAberto&&indice===i?'on':''} aria-label={`Imagem ${i+1} de ${nome}`} onClick={()=>mudar(i)}><img src={urlDaMidia(f.caminho_storage)??undefined} alt={f.alt_texto||nome} loading="lazy"/></button>)}
      {video&&<button className={`video-thumb ${videoAberto?'on':''}`} onClick={()=>setVideoAberto(true)}>▶ vídeo</button>}
    </div>
    {aberta&&navegacao&&<div className="foto-tela" ref={dialogo} role="dialog" aria-modal="true" aria-label={`Fotos em tela cheia de ${nome}`}>
      <div className="foto-barra"><span aria-live="polite">{fotoAberta+1}/{fotos.length}</span><button className="foto-fechar" aria-label="Fechar fotos" onClick={navegacao.fecharFoto}>×</button></div>
      <Carrossel fotos={fotos} nome={nome} indice={fotoAberta} mudar={i=>{mudar(i);navegacao.mudarFoto(i);}} telaCheia esgotada={esgotada}/>
    </div>}
  </div>;
}
