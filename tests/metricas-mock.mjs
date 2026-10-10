// Substitui @vercel/analytics nos testes: registra as chamadas sem enviar nada.
export const chamadas=globalThis.__metricas=(globalThis.__metricas||[]);
export function inject(o){chamadas.push(['inject',o]);}
export function pageview(o){chamadas.push(['pageview',o]);}
export function track(n,p){chamadas.push(['track',n,p]);}
