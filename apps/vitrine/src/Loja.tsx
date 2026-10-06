import { useEffect, useRef, useState } from 'react';
import { buscaDosFiltros, carregarCatalogo, colecaoSelecionada, filtrosIniciais, fotoPrincipal,
  lerFiltros, precoAtual, selecionarProdutos, tamanhosDoProduto, urlDaMidia } from './catalogo';
import type { Catalogo, Filtros, Produto } from './catalogo';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const selos = { aprovado_rose: 'Aprovado pela Rose', novidade: 'Novidade', ultimas_pecas: 'Últimas peças' };
const formas: Record<string, string> = {
  vestidos: 'M84 52 Q100 64 116 52 L134 64 L127 92 Q122 112 124 128 L154 232 Q100 246 46 232 L76 128 Q78 112 73 92 L66 64 Z',
  blusas: 'M78 66 Q100 80 122 66 L156 84 L148 116 L134 110 L134 196 Q100 204 66 196 L66 110 L52 116 L44 84 Z',
  conjuntos: 'M80 42 Q100 54 120 42 L148 56 L141 82 L130 78 L130 128 Q100 134 70 128 L70 78 L59 82 L52 56 Z M72 138 L128 138 L142 244 L110 244 L100 168 L90 244 L58 244 Z',
  'calcas-e-saias': 'M70 58 L130 58 L146 240 L112 240 L100 110 L88 240 L54 240 Z',
  kimonos: 'M80 50 Q100 62 120 50 L176 86 L164 136 L136 114 L138 232 L62 232 L64 114 L36 136 L24 86 Z',
};
function Ilustracao({ categoria = 'vestidos', tom = 0 }: { categoria?: string; tom?: number }) {
  const cores = ['#D9A3A9', '#D8BBA3', '#9DB2CF', '#A7B59C'];
  return <svg viewBox="0 0 200 260" aria-hidden="true" className="ilustracao">
    <rect width="200" height="260" fill={tom % 2 ? '#F3EBE2' : '#FAEDED'} />
    <circle cx="100" cy="138" r="84" fill="#fff" opacity=".55" />
    <path d="M100 30v12 M80 44Q100 30 120 44" stroke="#B98B4E" strokeWidth="1.6" fill="none" opacity=".7" />
    <path d={formas[categoria] ?? formas.vestidos} fill={cores[tom % cores.length]} stroke="rgba(0,0,0,.08)" />
  </svg>;
}
function ImagemPeca({ produto, categoria, tom = 0, destaque = false }: { produto: Produto; categoria?: string; tom?: number; destaque?: boolean }) {
  const foto = fotoPrincipal(produto), url = foto ? urlDaMidia(foto.caminho_storage) : null;
  const [urlComFalha, setUrlComFalha] = useState<string | null>(null);
  if (url && url !== urlComFalha) return <img src={url} alt={foto!.alt_texto} loading={destaque ? 'eager' : 'lazy'}
    decoding="async" width="400" height="500" onError={() => setUrlComFalha(url)} />;
  if (produto.codigo.startsWith('HOM-')) return <><Ilustracao categoria={categoria} tom={tom} /><span className="legenda-imagem">Ilustração demonstrativa</span></>;
  return <div className="sem-foto"><span>Rose Menezes</span><small>Foto em breve</small></div>;
}
function Marca({ catalogo }: { catalogo: Catalogo | null }) {
  const logo = catalogo?.logoUrl ?? '/marca/rose-menezes.jpg';
  const [urlComFalha, setUrlComFalha] = useState<string | null>(null);
  return <span className="marca"><img src={urlComFalha === logo ? '/marca/rose-menezes.jpg' : logo} alt="" width="48" height="48" onError={() => setUrlComFalha(logo)} />
    <span>{catalogo?.nomeLoja ?? 'Rose Menezes'}<small>MODA FEMININA</small></span></span>;
}
function Cartao({ produto, catalogo }: { produto: Produto; catalogo: Catalogo }) {
  const tamanhos = tamanhosDoProduto(catalogo.saldos, produto.id), esgotado = !tamanhos.some(t => t.disponivel > 0);
  const categoria = catalogo.categorias.find(c => c.id === produto.categoria_id);
  return <article className="cartao" aria-labelledby={`peca-${produto.id}`} data-produto={produto.codigo}>
    <div className="cartao-imagem"><ImagemPeca produto={produto} categoria={categoria?.slug} tom={Number(produto.codigo.match(/\d+$/)?.[0] ?? 0)} />
      {esgotado ? <span className="selo selo-esgotado">Esgotado</span> : produto.selo && <span className={`selo selo-${produto.selo}`}>{selos[produto.selo]}</span>}
    </div>
    <h3 id={`peca-${produto.id}`}>{produto.nome}</h3>
    <p className="preco">{produto.preco_promocional !== null && <><span className="sr-only">De </span><s>{moeda.format(produto.preco)}</s><span className="sr-only"> por </span></>}{moeda.format(precoAtual(produto))}</p>
    <p className="disponibilidade">{esgotado ? 'Indisponível no momento' : 'Disponível na coleção'}</p>
    {tamanhos.length > 0 && <ul className="tamanhos" aria-label="Disponibilidade por tamanho">{tamanhos.map(t =>
      <li key={t.tamanho} className={t.disponivel ? '' : 'indisponivel'} aria-label={`Tamanho ${t.tamanho}: ${t.disponivel ? 'disponível' : 'esgotado'}`}>{t.tamanho}</li>)}</ul>}
  </article>;
}
export function Loja() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [tentativa, setTentativa] = useState(0);
  const [filtros, setFiltros] = useState(() => lerFiltros(window.location.search));
  const [menuAberto, setMenuAberto] = useState(false);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const controle = new AbortController(); let ativo = true;
    const limite = setTimeout(() => controle.abort(), 15000);
    setEstado('carregando');
    carregarCatalogo(controle.signal).then(dados => {
      if (ativo) { setCatalogo(dados); setEstado('pronto'); }
    }).catch(() => { if (ativo) setEstado('erro'); }).finally(() => clearTimeout(limite));
    return () => { ativo = false; clearTimeout(limite); controle.abort(); };
  }, [tentativa]);
  useEffect(() => {
    const voltar = () => setFiltros(lerFiltros(window.location.search));
    window.addEventListener('popstate', voltar);
    return () => window.removeEventListener('popstate', voltar);
  }, []);
  useEffect(() => {
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape' && menuAberto) { setMenuAberto(false); botaoMenu.current?.focus(); } };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [menuAberto]);
  useEffect(() => { document.title = `${catalogo?.nomeLoja ?? 'Rose Menezes'} · Moda feminina`; }, [catalogo?.nomeLoja]);
  function atualizar(alteracao: Partial<Filtros>) {
    const novos = { ...filtros, ...alteracao }; setFiltros(novos);
    const busca = buscaDosFiltros(novos);
    window.history.pushState(null, '', `${window.location.pathname}${busca ? `?${busca}` : ''}#colecao`);
  }
  const limpar = () => atualizar(filtrosIniciais);
  const lista = catalogo ? selecionarProdutos(catalogo, filtros) : [];
  const colecaoSlug = catalogo ? colecaoSelecionada(catalogo, filtros) : '';
  const colecao = catalogo?.colecoes.find(c => c.slug === colecaoSlug);
  const temFiltros = !!(filtros.categoria || filtros.tamanho || filtros.disponiveis || filtros.colecao !== null || filtros.ordem !== 'novidades');
  const destaque = catalogo?.produtos.find(p => p.selo === 'aprovado_rose') ?? catalogo?.produtos[0];
  const tamanhos = [...new Set(catalogo?.saldos.map(v => v.tamanho) ?? [])].sort(new Intl.Collator('pt-BR', { numeric: true }).compare);
  const faixa = tamanhos.length > 1 ? `Peças do ${tamanhos[0]} ao ${tamanhos.at(-1)} que vestem bem o corpo de verdade.` : 'Peças que vestem bem o corpo de verdade.';
  return <>
    <a className="pular" href="#colecao">Pular para a coleção</a>
    <div className="aviso-ambiente">{import.meta.env.VITE_APP_ENV === 'homologation' ? 'Homologação' : 'Desenvolvimento'} · catálogo demonstrativo · não realiza vendas</div>
    <header className="cabecalho"><div className="container cabecalho-interno">
      <a href="#inicio" className="link-marca" aria-label={`${catalogo?.nomeLoja ?? 'Rose Menezes'} — início`} onClick={() => setMenuAberto(false)}><Marca catalogo={catalogo} /></a>
      <button ref={botaoMenu} className="botao-menu" type="button" aria-controls="navegacao" aria-expanded={menuAberto}
        aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuAberto(!menuAberto)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={menuAberto ? 'M6 6l12 12M6 18L18 6' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
      </button>
      <nav id="navegacao" className={menuAberto ? 'navegacao aberta' : 'navegacao'} aria-label="Principal">
        <a href="#inicio" onClick={() => setMenuAberto(false)}>Início</a><a href="#colecao" onClick={() => setMenuAberto(false)}>Coleção</a>
      </nav>
    </div></header>
    <main className="container" id="inicio">
      <section className="hero" aria-labelledby="titulo-home">
        <div className="hero-texto"><span className="sobretitulo">{colecao?.nome ?? 'Elegância que abraça'}</span>
          <h1 id="titulo-home">Bonita do seu jeito,<br />confortável o dia todo</h1>
          <p>{faixa} {catalogo?.descricaoLoja ?? 'Moda feminina escolhida com carinho para vestir o seu dia.'}</p>
          <a className="botao botao-principal" href="#colecao">Ver coleção <span aria-hidden="true">→</span></a>
        </div>
        <div className="hero-arte">{destaque && catalogo ? <ImagemPeca produto={destaque}
          categoria={catalogo.categorias.find(c => c.id === destaque.categoria_id)?.slug} destaque /> : <Ilustracao />}</div>
      </section>
      <section id="colecao" className="colecao" aria-labelledby="titulo-colecao" aria-busy={estado === 'carregando'}>
        <div className="titulo-colecao"><div><span className="sobretitulo">Escolha suas favoritas</span><h2 id="titulo-colecao">Nossa coleção</h2></div>
          {catalogo && catalogo.colecoes.length > 0 && <label className="campo-colecao">Coleção
            <select value={colecaoSlug} onChange={e => atualizar({ colecao: e.target.value })}>
              <option value="">Todas as coleções</option>
              {filtros.colecao && !colecao && <option value={filtros.colecao}>Coleção não encontrada</option>}
              {catalogo.colecoes.map(c => <option key={c.id} value={c.slug}>{c.nome}</option>)}
            </select></label>}
        </div>
        {estado === 'carregando' ? <div role="status" className="estado-catalogo"><span className="carregador" aria-hidden="true" />Carregando a coleção…</div>
          : estado === 'erro' ? <div role="alert" className="estado-catalogo"><h3>Não conseguimos carregar a coleção</h3><p>Confira sua conexão e tente novamente.</p><button className="botao botao-principal" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</button></div>
          : catalogo && <>
            <div className="categorias" role="group" aria-label="Categorias">
              <button className={`categoria ${!filtros.categoria ? 'selecionada' : ''}`} aria-pressed={!filtros.categoria} onClick={() => atualizar({ categoria: '' })}>Todas</button>
              {catalogo.categorias.map(c => <button key={c.id} className={`categoria ${filtros.categoria === c.slug ? 'selecionada' : ''}`}
                aria-pressed={filtros.categoria === c.slug} onClick={() => atualizar({ categoria: c.slug })}>{c.nome}</button>)}
            </div>
            {catalogo.produtos.length > 0 && <div className="barra-filtros">
              <p className="contagem" role="status" aria-live="polite">{lista.length} {lista.length === 1 ? 'peça' : 'peças'}</p>
              <label className="sr-only" htmlFor="tamanho">Tamanho</label>
              <select id="tamanho" value={filtros.tamanho} onChange={e => atualizar({ tamanho: e.target.value })}>
                <option value="">Todos os tamanhos</option>
                {filtros.tamanho && !tamanhos.includes(filtros.tamanho) && <option value={filtros.tamanho}>Tamanho {filtros.tamanho}</option>}
                {tamanhos.map(t => <option key={t} value={t}>Tamanho {t}</option>)}
              </select>
              <label className="sr-only" htmlFor="ordem">Ordenar peças</label>
              <select id="ordem" value={filtros.ordem} onChange={e => atualizar({ ordem: e.target.value as Filtros['ordem'] })}>
                <option value="novidades">Novidades</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option>
              </select>
              <label className="campo-checkbox"><input type="checkbox" checked={filtros.disponiveis} onChange={e => atualizar({ disponiveis: e.target.checked })} />Só disponíveis</label>
              {temFiltros && <button className="limpar-filtros" onClick={limpar}>Limpar filtros</button>}
            </div>}
            {lista.length ? <div className="grade-produtos">{lista.map(p => <Cartao key={p.id} produto={p} catalogo={catalogo} />)}</div>
              : <div className="estado-catalogo"><span className="assinatura">{catalogo.produtos.length ? 'Vamos tentar de novo?' : 'Novidades a caminho'}</span>
                <p>{catalogo.produtos.length ? 'Nenhuma peça encontrada com essa combinação de filtros.' : 'Nossa coleção está sendo preparada. Volte em breve para conhecer as peças.'}</p>
                {temFiltros && <button className="botao botao-secundario" onClick={limpar}>Limpar filtros</button>}</div>}
          </>}
      </section>
    </main>
    <footer className="rodape"><div className="container rodape-interno">
      <div><Marca catalogo={catalogo} /><p>{catalogo?.descricaoLoja ?? 'Moda feminina escolhida com carinho para vestir o seu dia.'}</p><span className="assinatura">Elegância que abraça</span></div>
      <nav aria-label="Navegação do rodapé"><h2>A coleção</h2><a href="#colecao" onClick={() => atualizar({ ...filtrosIniciais, colecao: '' })}>Ver todas as peças</a>
        {catalogo?.categorias.map(c => <a key={c.id} href="#colecao" onClick={() => atualizar({ categoria: c.slug })}>{c.nome}</a>)}</nav>
      <div className="rodape-frase"><p>Seu estilo.<br /><span>Seu jeito de ser.</span></p><a href="#inicio">Voltar ao início ↑</a></div>
    </div><div className="container rodape-base"><span>© {new Date().getFullYear()} {catalogo?.nomeLoja ?? 'Rose Menezes'} · Moda feminina</span><span>Ambiente de homologação</span></div></footer>
  </>;
}
