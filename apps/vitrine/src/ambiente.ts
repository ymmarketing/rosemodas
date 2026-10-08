type Variaveis = Record<string, string | undefined>;

export const recursosDeHomologacao = (ambiente: string | undefined) => ambiente === 'homologation';
export const referenciaHomologacao='kernpudxhwkpoadahgqj';

export const variaveisPublicas = [
  'VITE_APP_ENV', 'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PROJECT_REF',
] as const;
const permitidas = new Set<string>(variaveisPublicas);

// Compartilhado pelo build e pelo navegador; nunca aceita credenciais de servidor.
export function validarAmbiente(variaveis: Variaveis, exigirConfiguracao = false) {
  for (const nome of Object.keys(variaveis)) {
    if (nome.startsWith('VITE_') && !permitidas.has(nome)) {
      throw new Error('Variável pública não prevista para esta etapa.');
    }
  }
  const ambiente = variaveis.VITE_APP_ENV || 'development';
  if (!['development', 'homologation','production'].includes(ambiente)) {
    throw new Error('Ambiente de aplicação inválido.');
  }
  const url = variaveis.VITE_SUPABASE_URL || '';
  const chave = variaveis.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const referencia = variaveis.VITE_SUPABASE_PROJECT_REF || '';
  if (!url && !chave && !referencia && !exigirConfiguracao) return null;
  if (!url || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(chave)) {
    throw new Error('Configure a URL e uma chave publishable pública válida.');
  }
  if (ambiente === 'homologation'||ambiente==='production') {
    if (!/^[a-z0-9]{20}$/.test(referencia) || url !== `https://${referencia}.supabase.co`) {
      throw new Error('O endereço deve corresponder ao projeto Supabase configurado para este ambiente.');
    }
    if(ambiente==='production'&&referencia===referenciaHomologacao)throw new Error('Produção não pode utilizar o Supabase de homologação.');
  } else if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(url)) {
    throw new Error('DEV desta etapa deve usar o Supabase local.');
  }
  return { ambiente, url, chave, referencia };
}
