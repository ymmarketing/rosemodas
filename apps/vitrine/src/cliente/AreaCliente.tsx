import { useEffect, useMemo, useState } from 'react';
import { clienteAutenticado, servicoAcesso } from '../auth/acesso';
import { FormularioSenha } from '../auth/FormularioSenha';
import { Pedidos } from './Pedidos';
import './cliente.css';
export function AreaCliente() {
  const acesso=useMemo(()=>servicoAcesso('cliente'),[]);
  const [autorizada,setAutorizada]=useState(false),[carregando,setCarregando]=useState(true),[revisao,setRevisao]=useState(0),[erro,setErro]=useState('');
  useEffect(()=>acesso.observar(()=>{setAutorizada(false);setRevisao(n=>n+1);}),[acesso]);
  useEffect(()=>{let vivo=true;setCarregando(true);acesso.perfil().then(p=>{if(vivo)setAutorizada(Boolean(p?.ativo));}).catch(e=>{if(vivo)setErro(e.message);}).finally(()=>{if(vivo)setCarregando(false);});return()=>{vivo=false;};},[acesso,revisao]);
  return <div className="area-cliente"><header className="cabecalho-cliente"><a href="/#/loja"><img src="/marca/rose-menezes.jpg" alt="Rose Menezes"/> Voltar à loja</a><span>Área da cliente</span>{autorizada&&<button className="btn btn-s btn-sm" onClick={async()=>{try{await acesso.sair();setAutorizada(false);}catch(e){setErro(e instanceof Error?e.message:'Não foi possível sair.');}}}>Sair</button>}</header>
    <main>{erro&&<p className="erro-acesso" role="alert">{erro}</p>}{carregando?<p role="status">Verificando acesso…</p>:autorizada?<Pedidos sb={clienteAutenticado('cliente')}/>:<div className="cartao-acesso"><img src="/marca/rose-menezes.jpg" alt="Rose Menezes"/><FormularioSenha area="cliente" servico={acesso} entrou={()=>setRevisao(n=>n+1)}/></div>}</main>
  </div>;
}
