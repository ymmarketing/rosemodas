import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { criarClientePublico } from './supabase';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz ausente.');

function Preparacao() {
  const [estado, setEstado] = useState('verificando');
  const [mensagem, setMensagem] = useState('Verificando conexão pública com o catálogo…');
  useEffect(() => {
    let ativa = true;
    const controle = new AbortController();
    const limite = setTimeout(() => {
      if (ativa) {
        setEstado('pendente');
        setMensagem('A consulta excedeu o tempo de espera. Conexão ainda não validada.');
      }
      controle.abort();
    }, 10000);
    async function verificar() {
      try {
        const cliente = criarClientePublico();
        const { error } = await cliente.from('produtos').select('id', { head: true })
          .limit(1).abortSignal(controle.signal);
        if (controle.signal.aborted) return;
        if (error) throw new Error('Consulta pública indisponível. Confira a configuração de homologação.');
        setEstado('conectado');
        setMensagem('Conexão de leitura ao catálogo confirmada.');
      } catch {
        if (controle.signal.aborted) return;
        setEstado('pendente');
        setMensagem('Conexão pendente de configuração ou validação.');
      } finally { clearTimeout(limite); }
    }
    void verificar();
    return () => { ativa = false; clearTimeout(limite); controle.abort(); };
  }, []);
  return (
    <main>
      <h1>Rose Modas</h1>
      <p>{import.meta.env.VITE_APP_ENV === 'homologation' ? 'Homologação' : 'Desenvolvimento'} — em construção.</p>
      <p role="status" data-conexao={estado}>{mensagem}</p>
      <p>A vitrine será implementada na próxima etapa aprovada.</p>
    </main>
  );
}

createRoot(root).render(
  <StrictMode>
    <Preparacao />
  </StrictMode>,
);
