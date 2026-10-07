import type { Produto, Saldo } from './catalogo';

export function mensagemCompraWhatsApp(
  p: Pick<Produto, 'id'|'nome'|'codigo'|'slug'>, saldos: Saldo[], cor: string, tamanho: string, pagina: string,
) {
  if (!cor.trim()) throw new Error('Escolha uma cor primeiro.');
  if (!tamanho.trim()) throw new Error('Escolha o tamanho primeiro.');
  if (!saldos.some(v => v.produto_id === p.id && v.cor === cor && v.tamanho === tamanho && v.disponivel > 0)) {
    throw new Error('Esse tamanho está esgotado nessa cor. Escolha uma combinação disponível.');
  }
  const link = new URL(pagina);
  if (!['https:', 'http:'].includes(link.protocol)) throw new Error('Não foi possível preparar o link da peça.');
  link.search = ''; link.username = ''; link.password = '';
  link.hash = `/loja/produto/${encodeURIComponent(p.slug)}`;
  return `Oi Rose! Quero comprar esta peça:\nPeça: ${p.nome}\nCódigo: ${p.codigo}\nCor: ${cor}\nTamanho: ${tamanho}\nLink: ${link.href}`;
}
