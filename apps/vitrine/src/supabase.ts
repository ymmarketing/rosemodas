import { createClient } from '@supabase/supabase-js';
import { validarAmbiente } from './ambiente.ts';

let clientePublico: ReturnType<typeof createClient> | undefined;

// Somente leitura pública; o projeto é conferido antes de qualquer requisição.
export function criarClientePublico() {
  if (clientePublico) return clientePublico;
  const ambiente = validarAmbiente(import.meta.env, true);
  if (!ambiente) throw new Error('Ambiente Supabase ainda não configurado.');
  clientePublico = createClient(ambiente.url, ambiente.chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return clientePublico;
}
