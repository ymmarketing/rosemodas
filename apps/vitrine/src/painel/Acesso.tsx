import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { clienteInterno } from './catalogoInterno';

export function Acesso({onReady}:{onReady:()=>void}) {
  const [email,setEmail]=useState(''),[senha,setSenha]=useState(''),[codigo,setCodigo]=useState('');
  const [etapa,setEtapa]=useState<'carregando'|'login'|'senha'|'mfa'|'bloqueado'>('carregando');
  const [confirmarSenha,setConfirmarSenha]=useState('');
  const [erro,setErro]=useState(''),[ocupado,setOcupado]=useState(false),[factor,setFactor]=useState('');
  const [qr,setQr]=useState(''),[segredo,setSegredo]=useState('');
  async function conferir() {
    const sb=clienteInterno(), {data,error}=await sb.auth.getUser();
    if (error||!data.user) {setEtapa('login');return;}
    const {data:perfil,error:falha}=await sb.from('usuarios_internos').select('user_id,nome,papel,ativo,mfa_exigido').eq('user_id',data.user.id).maybeSingle();
    if (falha||!perfil?.ativo||!['admin','estoque'].includes(perfil.papel)) {setEtapa('bloqueado');return;}
    if (data.user.invited_at&&!data.user.user_metadata.senha_definida) {setEtapa('senha');return;}
    const {data:aal,error:erroAal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (erroAal) throw erroAal;
    if (aal?.currentLevel==='aal2') {onReady();return;}
    const {data:fatores,error:erroFatores}=await sb.auth.mfa.listFactors();
    if (erroFatores) throw erroFatores;
    const existente=fatores.totp.find(f=>f.status==='verified');
    if (existente) {setFactor(existente.id);setEtapa('mfa');return;}
    // Reutiliza um cadastro pendente na mesma tela, evitando fatores duplicados.
    setEtapa('mfa');
  }
  useEffect(()=>{let vivo=true;conferir().catch(()=>{if(vivo){setErro('Não foi possível verificar seu acesso. Tente entrar novamente.');setEtapa('login');}});return()=>{vivo=false;};},[]);
  async function login(e:FormEvent) {
    e.preventDefault();setErro('');setOcupado(true);
    try {const {error}=await clienteInterno().auth.signInWithPassword({email:email.trim(),password:senha});if(error)throw new Error('E-mail ou senha inválidos, ou conta ainda não habilitada.');setSenha('');await conferir();}
    catch(e){setErro(e instanceof Error?e.message:'Não foi possível entrar.');}finally{setOcupado(false);}
  }
  async function configurarMfa() {
    setOcupado(true);setErro('');
    try {
      const sb=clienteInterno(),{data:fatores,error:falha}=await sb.auth.mfa.listFactors();if(falha)throw falha;
      for(const f of fatores.all.filter(f=>f.factor_type==='totp'&&f.status==='unverified')){const {error}=await sb.auth.mfa.unenroll({factorId:f.id});if(error)throw error;}
      const {data,error}=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Painel Rose Menezes',issuer:'Rose Menezes'});if(error)throw error;
      setFactor(data.id);setQr(data.totp.qr_code);setSegredo(data.totp.secret);
    } catch {setErro('Não foi possível configurar a verificação. Tente novamente.');}finally{setOcupado(false);}
  }
  async function criarSenha(e:FormEvent) {
    e.preventDefault();setErro('');
    if(senha!==confirmarSenha){setErro('As duas senhas precisam ser iguais.');return;}
    setOcupado(true);
    try{const {error}=await clienteInterno().auth.updateUser({password:senha,data:{senha_definida:true}});if(error)throw error;setSenha('');setConfirmarSenha('');await conferir();}
    catch{setErro('Não foi possível definir a senha. Use pelo menos 12 caracteres e tente novamente.');}finally{setOcupado(false);}
  }
  async function verificar(e:FormEvent) {
    e.preventDefault();setOcupado(true);setErro('');
    try {const {error}=await clienteInterno().auth.mfa.challengeAndVerify({factorId:factor,code:codigo});if(error)throw error;setCodigo('');setQr('');setSegredo('');await conferir();}
    catch{setErro('Código inválido ou expirado. Confira o aplicativo autenticador.');}finally{setOcupado(false);}
  }
  return <main className="acesso-interno"><div className="acesso-card">
    <img src="/marca/rose-menezes.jpg" alt="Rose Menezes" width="64" height="64"/><span className="eyebrow">ACESSO INTERNO · HOMOLOGAÇÃO</span>
    <h1>{etapa==='mfa'?'Verificação em duas etapas':etapa==='senha'?'Defina sua senha':'Seu catálogo, organizado'}</h1>
    {etapa==='carregando'&&<p role="status">Verificando acesso…</p>}
    {etapa==='login'&&<form onSubmit={login}><p>Entre com sua conta de equipe habilitada.</p>
      <label htmlFor="equipe-email">E-mail</label><input id="equipe-email" className="input" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/>
      <label htmlFor="equipe-senha">Senha</label><input id="equipe-senha" className="input" type="password" autoComplete="current-password" required value={senha} onChange={e=>setSenha(e.target.value)}/>
      <button className="btn btn-p btn-block" disabled={ocupado}>{ocupado?'Entrando…':'Entrar'}</button>
      <p className="small muted">Primeiro acesso ou recuperação de senha: solicite a habilitação da sua conta à administração.</p></form>}
    {etapa==='senha'&&<form onSubmit={criarSenha}><p>Crie a senha que você usará para entrar no painel.</p><label htmlFor="nova-senha">Nova senha</label><input id="nova-senha" className="input" type="password" minLength={12} autoComplete="new-password" required value={senha} onChange={e=>setSenha(e.target.value)}/><label htmlFor="confirmar-senha">Repita a senha</label><input id="confirmar-senha" className="input" type="password" minLength={12} autoComplete="new-password" required value={confirmarSenha} onChange={e=>setConfirmarSenha(e.target.value)}/><button className="btn btn-p btn-block" disabled={ocupado}>Salvar senha e continuar</button></form>}
    {etapa==='mfa'&&<><p>Use um aplicativo autenticador para proteger o cadastro das peças.</p>
      {!factor&&<button className="btn btn-p" disabled={ocupado} onClick={configurarMfa}>Configurar autenticador</button>}
      {qr&&<><img className="mfa-qr" src={qr} alt="QR code para cadastrar este painel no aplicativo autenticador"/><details><summary>Configurar com chave manual</summary><code>{segredo}</code></details></>}
      {factor&&<form onSubmit={verificar}><label htmlFor="mfa-codigo">Código de 6 dígitos</label><input id="mfa-codigo" className="input" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={codigo} onChange={e=>setCodigo(e.target.value.replace(/\D/g,''))}/><button className="btn btn-p btn-block" disabled={ocupado}>Confirmar acesso</button></form>}
      <button className="btn btn-s" onClick={async()=>{await clienteInterno().auth.signOut();setFactor('');setQr('');setSegredo('');setEtapa('login');}}>Usar outra conta</button></>}
    {etapa==='bloqueado'&&<><p>Sua conta ainda não está habilitada para administrar o catálogo. Estar autenticada não concede acesso interno.</p><button className="btn btn-s" onClick={async()=>{await clienteInterno().auth.signOut();setEtapa('login');}}>Voltar ao login</button></>}
    {erro&&<p className="painel-erro" role="alert">{erro}</p>}
  </div></main>;
}
