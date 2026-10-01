import { createClient } from '@supabase/supabase-js';
import { validarAmbiente } from './ambiente';

// Somente leitura pública; o projeto é conferido antes de qualquer requisição.
export function criarClientePublico() {
  const ambiente = validarAmbiente(import.meta.env, true);
  if (!ambiente) throw new Error('Ambiente Supabase ainda não configurado.');
  return createClient(ambiente.url, ambiente.chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
