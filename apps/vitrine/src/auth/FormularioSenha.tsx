import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ServicoAcesso } from './acesso';
import { linkRecuperacaoCliente } from './acesso';
import './acesso.css';

export function FormularioSenha({area,servico,entrou}:{area:'equipe'|'cliente';servico:ServicoAcesso;entrou:()=>void}) {
  const [email,setEmail]=useState(''),[senha,setSenha]=useState(''),[mostrar,setMostrar]=useState(false);
  const [cadastro,setCadastro]=useState(false),[recuperar,setRecuperar]=useState(false);
  const [erro,setErro]=useState(''),[ocupado,setOcupado]=useState(false);
  const emAndamento=useRef(false);
  async function enviar(e:FormEvent) {
    e.preventDefault();if(emAndamento.current)return;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setErro('Informe um e-mail válido.');return;}
    if(senha.length<8){setErro('Use uma senha com pelo menos 8 caracteres.');return;}
    emAndamento.current=true;setOcupado(true);setErro('');
    try {
      if(cadastro)await servico.cadastrar(email,senha);else await servico.entrar(email,senha);
      setSenha('');entrou();
    }catch(e){setErro(e instanceof Error?e.message:'Não foi possível entrar. Tente novamente.');}
    finally{emAndamento.current=false;setOcupado(false);}
  }
  function mudar(){setCadastro(v=>!v);setRecuperar(false);setSenha('');setErro('');}
  return <div className="formulario-acesso">
    <h1>{recuperar?'Recuperar acesso':cadastro?'Crie sua conta':area==='equipe'?'Entrar no painel':'Entrar na sua área'}</h1>
    {erro&&<p className="erro-acesso" role="alert" aria-live="assertive">{erro}</p>}
    {recuperar?<>
      <p>{area==='equipe'?'Peça à administradora da loja para redefinir sua senha no Supabase.':'Fale com a gente pelo WhatsApp para recuperar seu acesso.'}</p>
      {area==='cliente'&&<a className="btn btn-p btn-block" href={linkRecuperacaoCliente} target="_blank" rel="noreferrer">Falar pelo WhatsApp</a>}
      <button className="btn btn-s btn-block" onClick={()=>setRecuperar(false)}>Voltar para entrar</button>
    </>:<>
      <p>{cadastro?'Cadastre seu e-mail e uma senha para acompanhar suas compras.':'Use seu e-mail e senha.'}</p>
      <form onSubmit={enviar} noValidate>
        <label htmlFor={`${area}-email`}>E-mail</label><input id={`${area}-email`} className="input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={ocupado}/>
        <label htmlFor={`${area}-senha`}>Senha</label><div className="campo-senha"><input id={`${area}-senha`} className="input" type={mostrar?'text':'password'} autoComplete={cadastro?'new-password':'current-password'} minLength={8} required value={senha} onChange={e=>setSenha(e.target.value)} disabled={ocupado}/><button type="button" aria-label={mostrar?'Ocultar senha':'Mostrar senha'} aria-pressed={mostrar} onClick={()=>setMostrar(v=>!v)}>{mostrar?'Ocultar':'Mostrar'}</button></div>
        <span className="small muted">Mínimo de 8 caracteres.</span>
        <button className="btn btn-p btn-block" disabled={ocupado}>{ocupado?'Aguarde…':cadastro?'Criar conta':'Entrar'}</button>
      </form>
      <button className="link-acesso" disabled={ocupado} onClick={()=>{setRecuperar(true);setErro('');setSenha('');}}>Esqueci minha senha</button>
      {area==='cliente'&&<button className="link-acesso" disabled={ocupado} onClick={mudar}>{cadastro?'Já tenho conta · Entrar':'Ainda não tenho conta · Cadastrar'}</button>}
    </>}
  </div>;
}
