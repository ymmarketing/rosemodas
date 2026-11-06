import type { Produto } from './catalogo';

// Promoção 11/11: 40% de desconto em todas as peças da vitrine.
// Antecipada a pedido: vale desde 06/11 às 17h e desliga sozinha ao fim de 30/11 (horário de Brasília).
export const PROMOCAO = {
  nome: 'Promoção 11/11',
  percentual: 40,
  inicio: Date.parse('2026-11-06T17:00:00-03:00'),
  fim: Date.parse('2026-12-01T00:00:00-03:00'),
  fimTexto: '30/11',
} as const;

// Só a prévia de um branch (rosemodas-git-<branch>-…vercel.app, exceto main) mostra a
// promoção antes da data, para conferência. Domínio oficial, *-psi.vercel.app, main e
// links de deploy de produção seguem só a data.
export function ehPrevia(host?: string) {
  if (host === undefined) { try { host = window.location.hostname ?? ''; } catch { host = ''; } }
  return host.endsWith('.vercel.app') && host.startsWith('rosemodas-git-') && !host.startsWith('rosemodas-git-main-');
}

export function promocaoAtiva(agora = Date.now(), host?: string) {
  return (agora >= PROMOCAO.inicio && agora < PROMOCAO.fim) || ehPrevia(host);
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/** Aplica o desconto sobre o preço cheio; se a peça já tiver oferta menor, mantém a menor. */
export function aplicarPromocao<T extends Pick<Produto, 'preco' | 'preco_promocional'>>(produtos: T[], ativa: boolean): T[] {
  if (!ativa) return produtos;
  return produtos.map(p => {
    if (!(p.preco > 0)) return p;
    const comDesconto = centavos(p.preco * (1 - PROMOCAO.percentual / 100));
    const oferta = p.preco_promocional !== null && p.preco_promocional < comDesconto ? p.preco_promocional : comDesconto;
    return { ...p, preco_promocional: oferta };
  });
}

// Peças mais vistas no site desde 09/10 (Vercel Web Analytics, páginas de peça).
// O carrossel usa esta ordem; peças que saírem da vitrine são puladas.
export const MAIS_VISTAS = ['peca-rm-0001', 'peca-rm-0036', 'peca-rm-0038', 'peca-rm-0002', 'peca-rm-0018', 'peca-rm-0026'];
