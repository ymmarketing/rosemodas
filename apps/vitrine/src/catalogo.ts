import { criarClientePublico } from './supabase.ts';

export type Categoria = { id: string; nome: string; slug: string; ordem: number };
export type Colecao = { id: string; nome: string; slug: string; atual: boolean };
export type Midia = { caminho_storage: string; alt_texto: string; tipo: string; principal: boolean; ordem: number };
export type Produto = {
  id: string; codigo: string; nome: string; slug: string; categoria_id: string;
  colecao_id: string | null; preco: number; preco_promocional: number | null;
  selo: 'aprovado_rose' | 'novidade' | 'ultimas_pecas' | null; midias: Midia[];
};
export type Saldo = { variacao_id: string; produto_id: string; tamanho: string; cor: string; disponivel: number };
export type Catalogo = {
  categorias: Categoria[]; colecoes: Colecao[]; produtos: Produto[]; saldos: Saldo[];
  nomeLoja: string; descricaoLoja: string; logoUrl: string | null;
};
export type Filtros = { categoria: string; colecao: string | null; tamanho: string; ordem: 'novidades' | 'menor' | 'maior'; disponiveis: boolean };
export const filtrosIniciais: Filtros = { categoria: '', colecao: null, tamanho: '', ordem: 'novidades', disponiveis: false };
const comparador = new Intl.Collator('pt-BR', { numeric: true });
export const precoAtual = (p: Produto) => p.preco_promocional ?? p.preco;
export const colecaoSelecionada = (catalogo: Catalogo, filtros: Filtros) => filtros.colecao ?? catalogo.colecoes.find(c => c.atual)?.slug ?? '';

export function tamanhosDoProduto(saldos: Saldo[], produtoId: string) {
  const totais = new Map<string, number>();
  for (const v of saldos) if (v.produto_id === produtoId) totais.set(v.tamanho, (totais.get(v.tamanho) ?? 0) + v.disponivel);
  return [...totais].sort(([a], [b]) => comparador.compare(a, b)).map(([tamanho, disponivel]) => ({ tamanho, disponivel }));
}
export function selecionarProdutos(catalogo: Catalogo, filtros: Filtros) {
  const categoriaId = catalogo.categorias.find(c => c.slug === filtros.categoria)?.id;
  const colecaoSlug = colecaoSelecionada(catalogo, filtros);
  const colecaoId = catalogo.colecoes.find(c => c.slug === colecaoSlug)?.id;
  const saldosPorProduto = new Map<string, Saldo[]>();
  for (const saldo of catalogo.saldos) {
    const grupo = saldosPorProduto.get(saldo.produto_id) ?? [];
    grupo.push(saldo); saldosPorProduto.set(saldo.produto_id, grupo);
  }
  return catalogo.produtos.filter(p => {
    if (filtros.categoria && p.categoria_id !== categoriaId) return false;
    if (colecaoSlug && p.colecao_id !== colecaoId) return false;
    const variacoes = saldosPorProduto.get(p.id) ?? [];
    if (filtros.tamanho && !variacoes.some(v => v.tamanho === filtros.tamanho && v.disponivel > 0)) return false;
    return !filtros.disponiveis || variacoes.some(v => v.disponivel > 0);
  }).sort((a, b) => {
    const diferenca = filtros.ordem === 'menor' ? precoAtual(a) - precoAtual(b)
      : filtros.ordem === 'maior' ? precoAtual(b) - precoAtual(a)
      : Number(b.selo === 'novidade') - Number(a.selo === 'novidade');
    return diferenca || comparador.compare(a.nome, b.nome) || a.id.localeCompare(b.id);
  });
}
export function lerFiltros(busca: string): Filtros {
  const q = new URLSearchParams(busca), ordem = q.get('ordem');
  return { categoria: q.get('categoria') ?? '', colecao: q.has('colecao') ? q.get('colecao')! : null,
    tamanho: q.get('tamanho') ?? '', ordem: ordem === 'menor' || ordem === 'maior' ? ordem : 'novidades',
    disponiveis: q.get('disponiveis') === '1' };
}
export function buscaDosFiltros(f: Filtros) {
  const q = new URLSearchParams();
  if (f.categoria) q.set('categoria', f.categoria);
  if (f.colecao !== null) q.set('colecao', f.colecao);
  if (f.tamanho) q.set('tamanho', f.tamanho);
  if (f.ordem !== 'novidades') q.set('ordem', f.ordem);
  if (f.disponiveis) q.set('disponiveis', '1');
  return q.toString();
}
export async function carregarCatalogo(signal: AbortSignal): Promise<Catalogo> {
  const cliente = criarClientePublico();
  // Paginação da API evita truncar o catálogo no limite padrão de 1.000 linhas.
  async function lerLista<T>(tabela: string, colunas: string, ordenacao: string): Promise<T[]> {
    const linhas: T[] = [], pagina = 500;
    for (let inicio = 0; ; inicio += pagina) {
      const { data, error } = await cliente.from(tabela).select(colunas).order(ordenacao)
        .range(inicio, inicio + pagina - 1).abortSignal(signal);
      if (error) throw new Error('Catálogo indisponível.');
      linhas.push(...(data ?? []) as unknown as T[]);
      if (!data || data.length < pagina) return linhas;
    }
  }
  const [categorias, colecoes, produtos, saldos, configuracoes] = await Promise.all([
    lerLista<Categoria>('categorias', 'id,nome,slug,ordem', 'id'),
    lerLista<Colecao>('colecoes', 'id,nome,slug,atual', 'id'),
    lerLista<Produto>('produtos', 'id,codigo,nome,slug,categoria_id,colecao_id,preco,preco_promocional,selo,midias(caminho_storage,alt_texto,tipo,principal,ordem)', 'id'),
    lerLista<Saldo>('v_estoque_disponivel', 'variacao_id,produto_id,tamanho,cor,disponivel', 'variacao_id'),
    lerLista<{ chave: string; valor: unknown }>('configuracoes', 'chave,valor', 'chave'),
  ]);
  const texto = (chave: string, padrao: string) => {
    const valor = configuracoes.find(c => c.chave === chave)?.valor;
    return typeof valor === 'string' && valor.trim() ? valor.trim() : padrao;
  };
  const caminhoLogo = texto('logo_caminho', '');
  return { categorias: categorias.sort((a, b) => a.ordem - b.ordem || comparador.compare(a.nome, b.nome)),
    colecoes: colecoes.sort((a, b) => Number(b.atual) - Number(a.atual) || comparador.compare(a.nome, b.nome)),
    produtos, saldos, nomeLoja: texto('nome_loja', 'Rose Menezes'),
    descricaoLoja: texto('descricao_loja', 'Moda feminina escolhida com carinho para vestir o seu dia.'),
    logoUrl: caminhoLogo ? urlDaMidia(caminhoLogo) : null };
}
export function urlDaMidia(caminho: string) {
  if (!caminho || caminho.startsWith('/') || caminho.includes('://') || caminho.split('/').some(p => p === '..')) return null;
  return criarClientePublico().storage.from('produtos-publico').getPublicUrl(caminho).data.publicUrl;
}
export function fotoPrincipal(produto: Produto) {
  return [...produto.midias].filter(m => m.tipo === 'foto')
    .sort((a, b) => Number(b.principal) - Number(a.principal) || a.ordem - b.ordem)[0] ?? null;
}
