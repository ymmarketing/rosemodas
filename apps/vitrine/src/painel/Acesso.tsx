import { useEffect, useMemo, useState } from 'react';
import { servicoAcesso } from '../auth/acesso';
import type { ServicoAcesso } from '../auth/acesso';
import { FormularioSenha } from '../auth/FormularioSenha';

export function Acesso({onReady,servico}:{onReady:()=>void;servico?:ServicoAcesso}) {
  const acesso=useMemo(()=>servico??servicoAcesso('equipe'),[servico]);
  const [etapa,setEtapa]=useState<'carregando'|'entrar'|'bloqueado'>('carregando');
  const [erro,setErro]=useState(''),[revisao,setRevisao]=useState(0);
  useEffect(()=>acesso.observar(()=>setRevisao(n=>n+1)),[acesso]);
  useEffect(()=>{
    let vivo=true;
    acesso.perfil().then(p=>{
      if(!vivo)return;
      if(!p){setEtapa('entrar');return;}
      if(p.role==='admin'&&p.ativo&&p.admin_autorizado){onReady();return;}
      setEtapa('bloqueado');
    }).catch(e=>{if(vivo){setErro(e.message);setEtapa('entrar');}});
    return()=>{vivo=false;};
  },[acesso,revisao,onReady]);
  return <main className="acesso-interno"><div className="acesso-card">
    <img src="/marca/rose-menezes.jpg" alt="Rose Menezes" width="64" height="64"/><span className="eyebrow">ACESSO INTERNO</span>
    {erro&&<p className="erro-acesso" role="alert">{erro}</p>}
    {etapa==='carregando'&&<p role="status">Verificando acesso…</p>}
    {etapa==='entrar'&&<FormularioSenha area="equipe" servico={acesso} entrou={()=>setRevisao(n=>n+1)}/>}
    {etapa==='bloqueado'&&<><h1>Acesso restrito</h1><p className="erro-acesso" role="alert">Esta conta não tem permissão de admin para acessar o painel. Entre com uma conta administrativa e senha.</p><a className="btn btn-p btn-block" href="/#/loja">Voltar à loja</a><button className="btn btn-s btn-block" onClick={async()=>{try{await acesso.sair();setErro('');setEtapa('entrar');}catch(e){setErro(e instanceof Error?e.message:'Não foi possível sair.');}}}>Usar outra conta</button></>}
  </div></main>;
}
