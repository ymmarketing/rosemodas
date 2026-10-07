import { validarAmbiente } from '../ambiente.ts';

export function sessaoPorCodigo(metodos: unknown) {
  return Array.isArray(metodos) && metodos.some(m =>
    m && typeof m === 'object' && ['otp','magiclink','invite'].includes(m.method));
}
export function telefoneDeAcesso(valor: string) {
  let digitos = valor.replace(/\D/g,'');
  if (/^\d{10,11}$/.test(digitos)) digitos = `55${digitos}`;
  if (!/^55[1-9]\d[2-9]\d{7,8}$/.test(digitos)) throw new Error('Informe o celular com DDD.');
  return `+${digitos}`;
}
export function mensagemErroAcesso(erro: {status?: number; code?: string}) {
  if (erro.status === 429 || ['over_email_send_rate_limit','over_sms_send_rate_limit','over_request_rate_limit'].includes(erro.code??''))
    return 'O envio atingiu o limite temporário. Use o último e-mail recebido e tente novamente mais tarde.';
  if (erro.code === 'sms_provider_disabled' || erro.code === 'phone_provider_disabled')
    return 'SMS ainda indisponível. Entre pelo seu e-mail.';
  return 'Não foi possível enviar o acesso. Confira os dados e tente novamente.';
}
export async function canaisDeAcesso(signal: AbortSignal) {
  const ambiente = validarAmbiente(import.meta.env,true);
  if (!ambiente) throw new Error('Ambiente indisponível.');
  const resposta = await fetch(`${ambiente.url}/auth/v1/settings`,{headers:{apikey:ambiente.chave},signal});
  if (!resposta.ok) throw new Error('Não foi possível consultar os canais de acesso.');
  const dados = await resposta.json();
  return {email:dados.external?.email===true,sms:dados.external?.phone===true};
}
