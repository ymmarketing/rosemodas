import { inject, pageview, track } from '@vercel/analytics';

// Métricas da vitrine (Vercel Web Analytics, sem cookies).
// Regras: só a vitrine pública é medida; painel e área da cliente nunca;
// nenhum dado pessoal (nome, telefone, e-mail, CEP completo, texto de busca) é enviado.

export type NomeEvento =
  | 'whatsapp_comprar' | 'whatsapp_encomendar' | 'whatsapp_duvida' | 'whatsapp_frete' | 'whatsapp_geral'
  | 'frete_calculado' | 'instagram_click' | 'filtro_categoria';

type Valor = string | number | boolean | null;

let iniciado = false;
let ultimoCaminho = '';

const areaInterna = (local: Pick<Location, 'pathname' | 'hash'>) =>
  /^\/(painel|cliente)(\/|$)/.test(local.pathname) || /^#\/(painel|cliente)(\/|$|\?)/.test(local.hash);

/** Converte a rota em hash (#/loja/produto/x?filtros) num caminho limpo, sem filtros nem busca. */
export function caminhoDaVitrine(hash: string): string {
  const rota = (hash || '').replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
  if (!rota || rota === 'loja' || rota === 'colecao') return '/';
  return `/${rota}`;
}

/** Agrupa as páginas de peça numa única rota, para o relatório "páginas mais vistas" continuar legível. */
export function rotaDaVitrine(caminho: string): string {
  return caminho.startsWith('/loja/produto/') ? '/loja/produto/[peca]' : caminho;
}

/** Só a UF do destino, nunca o CEP. Retorna '' se o CEP não for reconhecido. */
export function ufDoCep(cep: string): string {
  const n = Number(cep.replace(/\D/g, '').slice(0, 5));
  if (!Number.isFinite(n) || n < 1000) return '';
  const faixas: [number, number, string][] = [
    [1000, 19999, 'SP'], [20000, 28999, 'RJ'], [29000, 29999, 'ES'], [30000, 39999, 'MG'],
    [40000, 48999, 'BA'], [49000, 49999, 'SE'], [50000, 56999, 'PE'], [57000, 57999, 'AL'],
    [58000, 58999, 'PB'], [59000, 59999, 'RN'], [60000, 63999, 'CE'], [64000, 64999, 'PI'],
    [65000, 65999, 'MA'], [66000, 68899, 'PA'], [68900, 68999, 'AP'], [69000, 69299, 'AM'],
    [69300, 69399, 'RR'], [69400, 69899, 'AM'], [69900, 69999, 'AC'], [70000, 72799, 'DF'],
    [72800, 72999, 'GO'], [73000, 73699, 'DF'], [73700, 76799, 'GO'], [76800, 76999, 'RO'],
    [77000, 77999, 'TO'], [78000, 78899, 'MT'], [78900, 78999, 'RO'], [79000, 79999, 'MS'],
    [80000, 87999, 'PR'], [88000, 89999, 'SC'], [90000, 99999, 'RS'],
  ];
  return faixas.find(([a, b]) => n >= a && n <= b)?.[2] ?? '';
}

/** Liga o Web Analytics uma única vez. Chamado só pela vitrine (Loja). */
export function iniciarMetricas() {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;
  try {
    inject({
      framework: 'react',
      mode: import.meta.env.PROD ? 'production' : 'development',
      debug: false,
      disableAutoTrack: true,
      beforeSend: evento => {
        if (areaInterna(window.location)) return null;
        // Remove filtros, busca e hash da URL enviada: só o caminho limpo da vitrine.
        return { ...evento, url: `${window.location.origin}${caminhoDaVitrine(window.location.hash)}` };
      },
    });
  } catch { /* métrica nunca pode quebrar a loja */ }
}

/** Registra a visita a uma página da vitrine (ignora repetição da mesma página). */
export function registrarVisita(hash = window.location.hash) {
  if (!iniciado || areaInterna(window.location)) return;
  const caminho = caminhoDaVitrine(hash);
  if (caminho === ultimoCaminho) return;
  ultimoCaminho = caminho;
  try { pageview({ route: rotaDaVitrine(caminho), path: caminho }); } catch { /* idem */ }
}

/** Registra um clique/ação. Propriedades só com códigos e categorias, nunca dado pessoal. */
export function evento(nome: NomeEvento, propriedades?: Record<string, Valor>) {
  if (!iniciado || areaInterna(window.location)) return;
  try { track(nome, propriedades); } catch { /* idem */ }
}
