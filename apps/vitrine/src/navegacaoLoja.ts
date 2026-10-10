import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type FotoAberta = { slug: string; indice: number };
type Entrada = { roseId: string; roseScroll: number; roseFoto?: FotoAberta };
const entrada = (): Entrada | undefined => window.history?.state?.roseId ? window.history.state : undefined;
const novaId = () => Math.random().toString(36).slice(2);

// Cada entrada guarda sua própria posição, incluindo filtros repetidos no histórico.
export function useNavegacaoLoja(pronto: boolean, sincronizar: () => void) {
  const [versao, setVersao] = useState(0);
  const [foto, setFoto] = useState<FotoAberta | undefined>(() => entrada()?.roseFoto);
  const pendente = useRef<number | null>(null), sincronizarRef = useRef(sincronizar);
  sincronizarRef.current = sincronizar;
  const ultima = useRef('');
  function guardar() {
    const atual = entrada();
    if (atual && !atual.roseFoto) window.history.replaceState({ ...atual, roseScroll: window.scrollY }, '');
  }
  function receber() {
    const atual = entrada(), chave = `${window.location.href}|${atual?.roseId ?? ''}`;
    if (ultima.current === chave) return;
    ultima.current = chave;
    if (!atual) window.history.replaceState({ roseId: novaId(), roseScroll: 0 }, '');
    pendente.current = atual?.roseScroll ?? 0;
    setFoto(atual?.roseFoto);
    sincronizarRef.current();
    setVersao(v => v + 1);
  }
  useEffect(() => {
    const restauracao = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    if (!entrada()) window.history.replaceState({ roseId: novaId(), roseScroll: window.scrollY }, '');
    ultima.current = `${window.location.href}|${entrada()?.roseId}`;
    window.addEventListener('scroll', guardar, { passive: true });
    window.addEventListener('popstate', receber);
    window.addEventListener('hashchange', receber);
    return () => {
      window.history.scrollRestoration = restauracao;
      window.removeEventListener('scroll', guardar);
      window.removeEventListener('popstate', receber);
      window.removeEventListener('hashchange', receber);
    };
  }, []);
  useLayoutEffect(() => {
    if (pendente.current === null || !pronto) return;
    const y = pendente.current;
    pendente.current = null;
    window.scrollTo({ top: y, behavior: 'instant' });
  }, [versao, pronto]);
  function navegar(destino: string, manterPosicao = false) {
    guardar();
    const url = new URL(destino, window.location.href);
    // Rotas antigas e links compartilhados continuam válidos; apenas a navegação interna é interceptada.
    if (url.origin !== window.location.origin) return;
    window.history.pushState({ roseId: novaId(), roseScroll: manterPosicao ? window.scrollY : 0 }, '', url);
    receber();
  }
  function abrirFoto(slug: string, indice: number) {
    guardar();
    window.history.pushState({ roseId: novaId(), roseScroll: window.scrollY, roseFoto: { slug, indice } }, '');
    receber();
  }
  function mudarFoto(indice: number) {
    const atual = entrada();
    if (!atual?.roseFoto) return;
    const proxima = { ...atual.roseFoto, indice };
    window.history.replaceState({ ...atual, roseFoto: proxima }, '');
    setFoto(proxima);
  }
  return { navegar, foto, abrirFoto, mudarFoto, fecharFoto: () => { if (entrada()?.roseFoto) window.history.back(); } };
}
