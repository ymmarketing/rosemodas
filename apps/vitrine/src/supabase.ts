import { createClient } from '@supabase/supabase-js';

// Preparação do cliente de leitura. Não executa requisições nem autenticação.
export function criarClientePublico() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) throw new Error('Ambiente Supabase ainda não configurado.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
