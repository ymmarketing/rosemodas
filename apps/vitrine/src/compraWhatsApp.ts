import type { Produto, Saldo } from './catalogo';

export function mensagemEncomendaWhatsApp(p: Pick<Produto, 'nome'|'codigo'|'slug'>, tamanho: string, pagina: string) {
  const link = new URL(pagina);
  if (!['https:', 'http:'].includes(link.protocol)) throw new Error('Não foi possível preparar o link da peça.');
  link.search = ''; link.username = ''; link.password = '';
  link.hash = `/loja/produto/${encodeURIComponent(p.slug)}`;
  return `Oi Rose! Vi que a peça ${p.nome} (${p.codigo}) está esgotada. Gostaria de encomendar ou saber se volta.${tamanho.trim()?` Tamanho: ${tamanho}.`:''} Link: ${link.href}`;
}

export function mensagemCompraWhatsApp(
  p: Pick<Produto, 'id'|'nome'|'codigo'|'slug'>, saldos: Saldo[], cor: string, tamanho: string, pagina: string,
) {
  const disponiveis=saldos.filter(v=>v.produto_id===p.id&&v.disponivel>0);
  if(disponiveis.length===1&&(!cor||cor===disponiveis[0].cor)&&(!tamanho||tamanho===disponiveis[0].tamanho)){cor=disponiveis[0].cor;tamanho=disponiveis[0].tamanho;}
  if(disponiveis.some(v=>v.cor.trim())&&!cor.trim())throw new Error('Escolha uma cor primeiro.');
  if(disponiveis.some(v=>v.tamanho.trim())&&!tamanho.trim())throw new Error('Escolha o tamanho primeiro.');
  if (!saldos.some(v => v.produto_id === p.id && v.cor === cor && v.tamanho === tamanho && v.disponivel > 0)) {
    throw new Error('Esse tamanho está esgotado nessa cor. Escolha uma combinação disponível.');
  }
  const link = new URL(pagina);
  if (!['https:', 'http:'].includes(link.protocol)) throw new Error('Não foi possível preparar o link da peça.');
  link.search = ''; link.username = ''; link.password = '';
  link.hash = `/loja/produto/${encodeURIComponent(p.slug)}`;
  return `Oi Rose! Quero comprar esta peça:\nPeça: ${p.nome}\nCódigo: ${p.codigo}${cor.trim()?`\nCor: ${cor}`:''}${tamanho.trim()?`\nTamanho: ${tamanho}`:''}\nLink: ${link.href}`;
}
