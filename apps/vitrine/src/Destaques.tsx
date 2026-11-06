import { useCallback, useEffect, useRef, useState } from 'react';
import { precoAtual, tamanhosDoProduto } from './catalogo';
import type { Catalogo, Produto } from './catalogo';
import { Arte, moeda } from './Visual';
import { MAIS_VISTAS, PROMOCAO } from './promocao';
import { evento } from './metricas';

const INTERVALO = 4000;

/** As peças mais vistas, na ordem das métricas; completa com as primeiras da vitrine se faltar. */
export function pecasDoCarrossel(produtos: Produto[], limite = 6) {
  const porSlug = new Map(produtos.map(p => [p.slug, p]));
  const escolhidas = MAIS_VISTAS.map(s => porSlug.get(s)).filter((p): p is Produto => !!p);
  for (const p of produtos) {
    if (escolhidas.length >= limite) break;
    if (!escolhidas.includes(p) && p.midias.some(m => m.tipo === 'foto')) escolhidas.push(p);
  }
  return escolhidas.slice(0, limite);
}

export function Carrossel({ produtos, catalogo }: { produtos: Produto[]; catalogo: Catalogo }) {
  const [atual, setAtual] = useState(0);
  const pausado = useRef(false), toque = useRef<number | null>(null);
  const total = produtos.length;
  const ir = useCallback((i: number) => setAtual(((i % total) + total) % total), [total]);

  useEffect(() => {
    if (total < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => { if (!pausado.current && document.visibilityState !== 'hidden') setAtual(a => (a + 1) % total); }, INTERVALO);
    return () => clearInterval(t);
  }, [total]);

  if (!total) return null;
  return <div className="carrossel" aria-roledescription="carrossel" aria-label="Peças mais procuradas"
    onMouseEnter={() => { pausado.current = true; }} onMouseLeave={() => { pausado.current = false; }}
    onTouchStart={e => { pausado.current = true; toque.current = e.touches[0].clientX; }}
    onTouchEnd={e => {
      const inicio = toque.current; toque.current = null; pausado.current = false;
      if (inicio === null) return;
      const dx = e.changedTouches[0].clientX - inicio;
      if (Math.abs(dx) > 40) ir(atual + (dx < 0 ? 1 : -1));
    }}>
    {produtos.map((p, i) => {
      const esgotada = !tamanhosDoProduto(catalogo.saldos, p.id).some(t => t.disponivel > 0);
      return <a key={p.id} href={`#/loja/produto/${p.slug}`} className={`slide ${i === atual ? 'on' : ''}`}
        aria-hidden={i !== atual} tabIndex={i === atual ? 0 : -1}
        aria-label={`Ver ${p.nome}`} onClick={() => evento('carrossel_click', { codigo: p.codigo, posicao: i + 1 })}>
        <div className="slide-foto"><Arte produto={p} hero={i === 0} /></div>
        <div className="slide-info">
          <div className="slide-txt">
            <span className="slide-selo">{esgotada ? 'Esgotada · encomende' : i === 0 ? 'A mais procurada' : 'Mais procurada'}</span>
            <span className="slide-nome">{p.nome}</span>
            <span className="slide-preco">{p.preco_promocional !== null && <s>{moeda(p.preco)}</s>}<b>{moeda(precoAtual(p))}</b></span>
          </div>
          <span className="slide-btn">Ver peça</span>
        </div>
      </a>;
    })}
    {total > 1 && <>
      <button type="button" className="car-seta ant" aria-label="Peça anterior" onClick={() => ir(atual - 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
      <button type="button" className="car-seta prox" aria-label="Próxima peça" onClick={() => ir(atual + 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
      <div className="car-pontos">{produtos.map((p, i) => <button key={p.id} type="button" aria-label={`Ir para ${p.nome}`} aria-current={i === atual} onClick={() => ir(i)}><span className={i === atual ? 'on' : ''} /></button>)}</div>
    </>}
  </div>;
}

export function BannerPromocao() {
  return <div className="promo-banner">
    <span className="promo-eyebrow">{PROMOCAO.nome} · até {PROMOCAO.fimTexto}</span>
    <div className="promo-num"><b>{PROMOCAO.percentual}%</b><i>off</i></div>
    <p className="promo-sub">em qualquer peça do site</p>
    <p className="promo-txt">Do P ao Plus Size. Peças selecionadas e únicas: o desconto já aparece no preço.</p>
    <a className="promo-cta" href="#colecao" onClick={e => { e.preventDefault(); document.getElementById('colecao')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver todas com {PROMOCAO.percentual}% off</a>
  </div>;
}
