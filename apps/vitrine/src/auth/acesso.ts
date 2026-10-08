import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validarAmbiente } from '../ambiente.ts';

export type PerfilAcesso = { role: 'admin'|'cliente'; ativo: boolean; admin_autorizado: boolean };
const clientes = new Map<string,SupabaseClient>();
export function clienteAutenticado(area:'equipe'|'cliente') {
  const ambiente=validarAmbiente(import.meta.env,true);
  if(!ambiente)throw new Error('Ambiente ainda não configurado.');
  const chave=`rose-${area}-${ambiente.referencia}`;
  if(!clientes.has(chave))clientes.set(chave,createClient(ambiente.url,ambiente.chave,{
    auth:{storageKey:chave,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},
  }));
  return clientes.get(chave)!;
}
export function mensagemErroSenha(erro:{code?:string;status?:number}) {
  if(erro.status===429||erro.code==='over_request_rate_limit')return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  if(erro.code==='invalid_credentials')return 'E-mail não cadastrado ou senha incorreta. Confira os dados e tente novamente.';
  if(erro.code==='email_not_confirmed')return 'Sua conta ainda não está habilitada. Fale com a loja para liberar o acesso.';
  if(erro.code==='user_already_exists')return 'Este e-mail já está cadastrado. Entre com sua senha.';
  if(erro.code==='weak_password')return 'Use uma senha com pelo menos 8 caracteres.';
  if(erro.code==='signup_disabled')return 'O cadastro está temporariamente indisponível. Fale com a loja pelo WhatsApp.';
  return 'Não foi possível entrar. Confira sua conexão e tente novamente.';
}
export type ServicoAcesso = {
  entrar:(email:string,senha:string)=>Promise<void>;
  cadastrar:(email:string,senha:string,dados?:{nome:string;whatsapp:string;aceite_privacidade:boolean})=>Promise<void>;
  perfil:()=>Promise<PerfilAcesso|null>;
  sair:()=>Promise<void>;
  observar:(mudou:()=>void)=>()=>void;
  cadastroDisponivel?:()=>Promise<boolean>;
};
export function servicoAcesso(area:'equipe'|'cliente'):ServicoAcesso {
  const sb=clienteAutenticado(area);
  return {
    async cadastroDisponivel() {
      if(area!=='cliente')return false;
      const ambiente=validarAmbiente(import.meta.env,true)!;
      const r=await fetch(`${ambiente.url}/auth/v1/settings`,{headers:{apikey:ambiente.chave}});
      if(!r.ok)return false;
      const c=await r.json();return c.mailer_autoconfirm===true&&c.disable_signup!==true;
    },
    async entrar(email,senha) {
      const {error}=await sb.auth.signInWithPassword({email:email.trim().toLowerCase(),password:senha});
      if(error)throw new Error(mensagemErroSenha(error));
    },
    async cadastrar(email,senha,dados) {
      if(area!=='cliente')throw new Error('O painel interno não permite cadastro público.');
      const ambiente=validarAmbiente(import.meta.env,true)!;
      const resposta=await fetch(`${ambiente.url}/auth/v1/settings`,{headers:{apikey:ambiente.chave}});
      if(!resposta.ok)throw new Error('Não foi possível verificar o cadastro. Tente novamente.');
      const configuracao=await resposta.json();
      if(configuracao.mailer_autoconfirm!==true||configuracao.disable_signup===true)
        throw new Error('O cadastro está temporariamente indisponível. Fale com a loja pelo WhatsApp.');
      if(!dados?.nome.trim()||!/^\+55[0-9]{10,11}$/.test(dados.whatsapp)||!dados.aceite_privacidade)throw new Error('Informe nome, WhatsApp e aceite a política de privacidade.');
      const {data,error}=await sb.auth.signUp({email:email.trim().toLowerCase(),password:senha,options:{data:dados}});
      if(error)throw new Error(mensagemErroSenha(error));
      if(!data.session)throw new Error('O cadastro não liberou o acesso. Fale com a loja pelo WhatsApp.');
    },
    async perfil() {
      const {data,error}=await sb.auth.getUser();
      if(error||!data.user)return null;
      const r=await sb.rpc('meu_acesso');
      if(r.error)throw new Error('Não foi possível verificar sua permissão. Tente novamente.');
      return r.data as PerfilAcesso|null;
    },
    async sair(){const {error}=await sb.auth.signOut();if(error)throw new Error('Não foi possível sair. Tente novamente.');},
    observar(mudou){const {data}=sb.auth.onAuthStateChange(()=>mudou());return()=>data.subscription.unsubscribe();},
  };
}
export const linkRecuperacaoCliente='https://wa.me/5531975417483?text='+encodeURIComponent('Oi Rose! Preciso de ajuda para recuperar meu acesso à área da cliente.');
