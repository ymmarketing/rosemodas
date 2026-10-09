import { cadastroLiberadoNoPrazo } from './auth/corte.ts';
import { criarClientePublico } from './supabase.ts';

export type Categoria = { id: string; nome: string; slug: string; ordem: number };
export type Colecao = { id: string; nome: string; slug: string; atual: boolean };
export type Midia = { caminho_storage: string; alt_texto: string; tipo: string; principal: boolean; ordem: number };
export type Produto = {
  id: string; codigo: string; nome: string; slug: string; categoria_id: string;
  colecao_id: string | null; preco: number; preco_promocional: number | null;
  selo: 'aprovado_rose' | 'novidade' | 'ultimas_pecas' | null; midias: Midia[];
  dado_teste?: boolean; ordem_vitrine?: number; descricao?: string; modelo_veste?: string | null;
  variacoes?: { id: string; sku: string; tamanho: string; cor: string }[];
};
export type Medida = { produto_id: string; tamanho: string; medida: string; rotulo: string; valor_cm: number; ordem: number };
export type Saldo = { variacao_id: string; produto_id: string; tamanho: string; cor: string; disponivel: number };
export type Catalogo = {
  categorias: Categoria[]; colecoes: Colecao[]; produtos: Produto[]; saldos: Saldo[];
  nomeLoja: string; descricaoLoja: string; logoUrl: string | null;
  hero?:{desktop:string;mobile:string;alt:string}|null;
  cadastroClienteDisponivel?: boolean; cnpj?:string; medidas?: Medida[]; whatsappNumero?: string | null; instagramUrl?: string | null;
};
export type Filtros = { categoria: string; colecao: string | null; tamanho: string; ordem: 'novidades' | 'menor' | 'maior'; disponiveis: boolean; busca?: string };
export const filtrosIniciais: Filtros = { categoria: '', colecao: null, tamanho: '', ordem: 'novidades', disponiveis: false };
const comparador = new Intl.Collator('pt-BR', { numeric: true });
export function categoriasDisponiveis(catalogo: Pick<Catalogo, 'categorias' | 'produtos' | 'saldos'>) {
  const disponiveis = new Set(catalogo.saldos.filter(s => s.disponivel > 0).map(s => s.produto_id));
  const quantidades = new Map<string, number>();
  for (const p of catalogo.produtos) {
    if (disponiveis.has(p.id)) quantidades.set(p.categoria_id, (quantidades.get(p.categoria_id) ?? 0) + 1);
  }
  return catalogo.categorias.map(c => ({ ...c, quantidade: quantidades.get(c.id) ?? 0 }))
    .filter(c => c.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade || comparador.compare(a.nome, b.nome));
}
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
    if (filtros.busca && !normalizar(`${p.nome} ${p.codigo}`).includes(normalizar(filtros.busca))) return false;
    if (filtros.categoria && p.categoria_id !== categoriaId) return false;
    if (colecaoSlug && p.colecao_id !== colecaoId) return false;
    const variacoes = saldosPorProduto.get(p.id) ?? [];
    if (filtros.tamanho && !variacoes.some(v => v.tamanho === filtros.tamanho && v.disponivel > 0)) return false;
    return !filtros.disponiveis || variacoes.some(v => v.disponivel > 0);
  }).sort((a, b) => {
    const disponivel=(p:Produto)=>(saldosPorProduto.get(p.id)??[]).some(v=>v.disponivel>0);
    const esgotadas=Number(disponivel(b))-Number(disponivel(a));
    if(esgotadas)return esgotadas;
    const diferenca = filtros.ordem === 'menor' ? precoAtual(a) - precoAtual(b)
      : filtros.ordem === 'maior' ? precoAtual(b) - precoAtual(a)
      : (a.ordem_vitrine??0)-(b.ordem_vitrine??0) || Number(b.selo === 'novidade') - Number(a.selo === 'novidade');
    return diferenca || comparador.compare(a.codigo, b.codigo) || a.id.localeCompare(b.id);
  });
}
export function lerFiltros(busca: string): Filtros {
  const q = new URLSearchParams(busca), ordem = q.get('ordem');
  return { categoria: q.get('categoria') ?? '', colecao: q.get('colecao')==='hom-lancamento'?'lancamento':q.has('colecao') ? q.get('colecao')! : null,
    tamanho: q.get('tamanho') ?? '', ordem: ordem === 'menor' || ordem === 'maior' ? ordem : 'novidades',
    disponiveis: q.get('disponiveis') === '1', ...(q.get('busca') ? { busca: q.get('busca')! } : {}) };
}
export function buscaDosFiltros(f: Filtros) {
  const q = new URLSearchParams();
  if (f.categoria) q.set('categoria', f.categoria);
  if (f.colecao !== null) q.set('colecao', f.colecao);
  if (f.tamanho) q.set('tamanho', f.tamanho);
  if (f.ordem !== 'novidades') q.set('ordem', f.ordem);
  if (f.disponiveis) q.set('disponiveis', '1');
  if (f.busca?.trim()) q.set('busca', f.busca.trim());
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
  const [categorias, colecoes, produtos, saldos, medidas, configuracoes] = await Promise.all([
    lerLista<Categoria>('categorias', 'id,nome,slug,ordem', 'id'),
    lerLista<Colecao>('colecoes', 'id,nome,slug,atual', 'id'),
    lerLista<Produto>('produtos', 'id,codigo,nome,slug,descricao,modelo_veste,categoria_id,colecao_id,preco,preco_promocional,selo,dado_teste,ordem_vitrine,variacoes(id,sku,tamanho,cor),midias(caminho_storage,alt_texto,tipo,principal,ordem)', 'id'),
    lerLista<Saldo>('v_estoque_disponivel', 'variacao_id,produto_id,tamanho,cor,disponivel', 'variacao_id'),
    lerLista<Medida>('medidas_tamanho', 'produto_id,tamanho,medida,rotulo,valor_cm,ordem', 'id'),
    lerLista<{ chave: string; valor: unknown }>('configuracoes', 'chave,valor', 'chave'),
  ]);
  const ambiente=await import('./ambiente.ts').then(m=>m.validarAmbiente(import.meta.env,true));
  let cadastroClienteDisponivel=false;
  if(ambiente){try{const r=await fetch(`${ambiente.url}/auth/v1/settings`,{headers:{apikey:ambiente.chave},signal});if(r.ok){const c=await r.json();cadastroClienteDisponivel=c.mailer_autoconfirm===true&&c.disable_signup!==true&&cadastroLiberadoNoPrazo(configuracoes.find(c=>c.chave==='cadastro_cliente_liberado')?.valor);}}catch{}}
  const texto = (chave: string, padrao: string) => {
    const valor = configuracoes.find(c => c.chave === chave)?.valor;
    return typeof valor === 'string' && valor.trim() ? valor.trim() : padrao;
  };
  const destaque=configuracoes.find(c=>c.chave==='hero_lancamento')?.valor as {desktop?:string;mobile?:string;alt?:string}|undefined;
  const hero=destaque&&typeof destaque.desktop==='string'&&typeof destaque.mobile==='string'&&typeof destaque.alt==='string'&&urlDaMidia(destaque.desktop)&&urlDaMidia(destaque.mobile)?{desktop:urlDaMidia(destaque.desktop)!,mobile:urlDaMidia(destaque.mobile)!,alt:destaque.alt}:null;
  const caminhoLogo = texto('logo_caminho', '');
  return { categorias: categorias.sort((a, b) => a.ordem - b.ordem || comparador.compare(a.nome, b.nome)),
    colecoes: colecoes.sort((a, b) => Number(b.atual) - Number(a.atual) || comparador.compare(a.nome, b.nome)),
    produtos, saldos, medidas, hero, nomeLoja: texto('nome_loja', 'Rose Menezes'),
    descricaoLoja: texto('descricao_loja', 'Moda feminina escolhida com carinho para vestir o seu dia.'),
    cadastroClienteDisponivel, logoUrl: caminhoLogo ? urlDaMidia(caminhoLogo) : null,
    whatsappNumero: numeroWhatsApp(texto('whatsapp_numero', '')),
    instagramUrl: 'https://www.instagram.com/rosemenezes_modas/', cnpj: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(texto('cnpj_loja',''))&&texto('cnpj_loja','')!=='00.000.000/0001-00'?texto('cnpj_loja',''):'' };
}
export const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
export function numeroWhatsApp(s: string) {
  const n = s.replace(/[^0-9]/g, '');
  return /^55[1-9][0-9][0-9]{8,9}$/.test(n) ? n : null;
}
export function linkWhatsApp(numero: string | null | undefined, mensagem: string) {
  const n = numero ? numeroWhatsApp(numero) : null;
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}` : null;
}
export function linkInstagram(s: string) {
  try { const u = new URL(s); return u.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(u.hostname) ? u.href : null; }
  catch { return null; }
}
export function urlDaMidia(caminho: string) {
  if (!caminho || caminho.startsWith('/') || caminho.includes('://') || caminho.split('/').some(p => p === '..')) return null;
  return criarClientePublico().storage.from('produtos-publico').getPublicUrl(caminho).data.publicUrl;
}
export function fotoPrincipal(produto: Produto) {
  return [...produto.midias].filter(m => m.tipo === 'foto')
    .sort((a, b) => Number(b.principal) - Number(a.principal) || a.ordem - b.ordem)[0] ?? null;
}
