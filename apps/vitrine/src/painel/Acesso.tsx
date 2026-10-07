import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { clienteInterno, painelUrl } from './catalogoInterno';
import { canaisDeAcesso, mensagemErroAcesso, sessaoPorCodigo, telefoneDeAcesso } from './acessoSemSenha';

export function Acesso({onReady}:{onReady:()=>void}) {
  const [email,setEmail]=useState(''),[telefone,setTelefone]=useState(''),[codigo,setCodigo]=useState('');
  const [canal,setCanal]=useState<'email'|'sms'>('email');
  const [canais,setCanais]=useState({email:true,sms:false});
  const [etapa,setEtapa]=useState<'carregando'|'identificar'|'email_enviado'|'sms_codigo'|'bloqueado'>('carregando');
  const [erro,setErro]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).has('error')?'Este acesso expirou ou não pôde ser confirmado. Receba um novo acesso abaixo.':'');
  const [ocupado,setOcupado]=useState(false),[revisao,setRevisao]=useState(0),[reenviarEm,setReenviarEm]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    canaisDeAcesso(controller.signal).then(setCanais).catch(()=>{});
    const {data}=clienteInterno().auth.onAuthStateChange(event=>{
      if(['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))setRevisao(n=>n+1);
    });
    return()=>{controller.abort();data.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    let vivo=true;
    async function conferir() {
      const sb=clienteInterno(),{data,error}=await sb.auth.getUser();
      if(!vivo)return;
      if(error||!data.user){setEtapa(e=>e==='carregando'?'identificar':e);return;}
      const {data:perfil,error:falha}=await sb.from('usuarios_internos').select('user_id,papel,ativo,mfa_exigido').eq('user_id',data.user.id).maybeSingle();
      if(!vivo)return;
      if(falha||!perfil?.ativo||!['admin','estoque'].includes(perfil.papel)){setEtapa('bloqueado');return;}
      const {data:aal,error:falhaAal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if(!vivo)return;
      if(falhaAal)throw falhaAal;
      if(perfil.mfa_exigido?aal?.currentLevel==='aal2':sessaoPorCodigo(aal?.currentAuthenticationMethods)){onReady();return;}
      setEtapa('identificar');
    }
    conferir().catch(()=>{if(vivo){setErro('Não foi possível confirmar seu acesso. Tente novamente.');setEtapa('identificar');}});
    return()=>{vivo=false;};
  },[revisao,onReady]);
  useEffect(()=>{if(reenviarEm===0)return;const timer=setTimeout(()=>setReenviarEm(n=>Math.max(0,n-1)),1000);return()=>clearTimeout(timer);},[reenviarEm]);
  async function enviar(e?:FormEvent) {
    e?.preventDefault();setErro('');setOcupado(true);
    try {
      const sb=clienteInterno();
      const {error}=canal==='email'
        ?await sb.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{shouldCreateUser:false,emailRedirectTo:painelUrl}})
        :await sb.auth.signInWithOtp({phone:telefoneDeAcesso(telefone),options:{shouldCreateUser:false}});
      if(error)throw new Error(mensagemErroAcesso(error));
      setCodigo('');setReenviarEm(60);setEtapa(canal==='email'?'email_enviado':'sms_codigo');
    }catch(e){setErro(e instanceof Error?e.message:'Não foi possível enviar o acesso.');}finally{setOcupado(false);}
  }
  async function verificar(e:FormEvent) {
    e.preventDefault();setOcupado(true);setErro('');
    try {
      const {error}=canal==='email'
        ?await clienteInterno().auth.verifyOtp({email:email.trim().toLowerCase(),token:codigo,type:'email'})
        :await clienteInterno().auth.verifyOtp({phone:telefoneDeAcesso(telefone),token:codigo,type:'sms'});
      if(error)throw error;
      setCodigo('');setRevisao(n=>n+1);
    }catch{setErro('Código inválido ou expirado. Confira o último código recebido ou solicite um novo.');}finally{setOcupado(false);}
  }
  function trocar(){setEtapa('identificar');setCodigo('');setErro('');}
  const confirmarCodigo=<form onSubmit={verificar}><label htmlFor="acesso-codigo">Código recebido</label><input id="acesso-codigo" className="input" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={codigo} onChange={e=>setCodigo(e.target.value.replace(/\D/g,''))}/><button className="btn btn-p btn-block" disabled={ocupado}>{ocupado?'Confirmando…':'Entrar no painel'}</button></form>;
  return <main className="acesso-interno"><div className="acesso-card">
    <img src="/marca/rose-menezes.jpg" alt="Rose Menezes" width="64" height="64"/><span className="eyebrow">ACESSO INTERNO · HOMOLOGAÇÃO</span>
    <h1>{etapa==='email_enviado'?'Confira seu e-mail':etapa==='sms_codigo'?'Confira seu SMS':'Seu catálogo, organizado'}</h1>
    {etapa==='carregando'&&<p role="status">Verificando acesso…</p>}
    {etapa==='identificar'&&<><p>Entre pelo seu e-mail ou celular, sem senha.</p>
      <div className="canais-acesso" aria-label="Forma de acesso"><button type="button" aria-pressed={canal==='email'} disabled={ocupado||!canais.email} onClick={()=>{setCanal('email');setErro('');}}>E-mail</button><button type="button" aria-pressed={canal==='sms'} disabled={ocupado||!canais.sms} onClick={()=>{setCanal('sms');setErro('');}}>SMS</button></div>
      <form onSubmit={enviar}>{canal==='email'?<><label htmlFor="equipe-email">E-mail</label><input id="equipe-email" className="input" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></>:<><label htmlFor="equipe-celular">Celular com DDD</label><input id="equipe-celular" className="input" type="tel" autoComplete="tel" required placeholder="(31) 99999-9999" value={telefone} onChange={e=>setTelefone(e.target.value)}/></>}
        <button className="btn btn-p btn-block" disabled={ocupado||reenviarEm>0}>{ocupado?'Enviando…':reenviarEm>0?`Aguarde ${reenviarEm}s`:canal==='email'?'Receber acesso por e-mail':'Receber código por SMS'}</button></form>
      {!canais.sms&&<p className="small muted">SMS ainda indisponível. Use o e-mail para entrar.</p>}</>}
    {etapa==='email_enviado'&&<><p role="status">Se sua conta estiver habilitada, você receberá o acesso em <strong>{email.trim().toLowerCase()}</strong>.</p><p>Clique no botão do e-mail para abrir o painel. Confira também o spam.</p><details><summary>Recebi um código</summary>{confirmarCodigo}</details></>}
    {etapa==='sms_codigo'&&<><p role="status">Digite o código enviado para o celular cadastrado na sua conta.</p>{confirmarCodigo}</>}
    {['email_enviado','sms_codigo'].includes(etapa)&&<div className="acesso-acoes"><button className="btn btn-s" disabled={ocupado||reenviarEm>0} onClick={()=>enviar()}>{reenviarEm>0?`Reenviar em ${reenviarEm}s`:'Reenviar acesso'}</button><button className="btn btn-s" disabled={ocupado} onClick={trocar}>Corrigir e-mail ou celular</button></div>}
    {etapa==='bloqueado'&&<><p>Sua conta ainda não está habilitada para administrar o catálogo.</p><button className="btn btn-s" onClick={async()=>{await clienteInterno().auth.signOut();trocar();}}>Usar outra conta</button></>}
    {erro&&<p className="painel-erro" role="alert">{erro}</p>}
  </div></main>;
}
