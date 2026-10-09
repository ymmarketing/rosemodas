import {useCallback,useEffect,useState} from 'react';
import {clienteInterno} from './catalogoInterno';
type Conciliacao={id:string;email_informado:string;nome_anterior:string;nome_novo:string;whatsapp_anterior:string|null;whatsapp_novo:string|null;compras_anteriores:number};
export function ConciliacoesClientes(){
 const [lista,setLista]=useState<Conciliacao[]>([]),[erro,setErro]=useState(''),[ocupado,setOcupado]=useState(false),[registro,setRegistro]=useState<Record<string,string>>({});
 const carregar=useCallback(async()=>{setOcupado(true);setErro('');try{const r=await clienteInterno().rpc('conciliacoes_clientes');if(r.error)throw r.error;setLista(r.data??[]);}catch{setErro('Não foi possível carregar os vínculos pendentes.');}finally{setOcupado(false);}},[]);
 useEffect(()=>{void carregar();},[carregar]);
 async function vincular(id:string){if((registro[id]??'').trim().length<10){setErro('Registre a confirmação que fez com a cliente pelo WhatsApp.');return;}setOcupado(true);setErro('');try{const r=await clienteInterno().rpc('conciliacoes_clientes',{p_id:id,p_confirmacao_whatsapp:registro[id]});if(r.error)throw new Error(r.error.message);await carregar();}catch(e){setErro(e instanceof Error?e.message:'Não foi possível vincular as compras.');}finally{setOcupado(false);}}
 return <section><div className="painel-cabecalho"><div><span className="eyebrow">CLIENTES</span><h1>Vínculos pendentes</h1><p>O e-mail igual não libera compras antigas. Confirme a titularidade com a cliente pelo WhatsApp antes de vincular.</p></div></div>{erro&&<p className="painel-erro" role="alert">{erro}</p>}
 {ocupado&&<p role="status">Aguarde…</p>}{!ocupado&&!lista.length&&<p>Nenhum vínculo pendente.</p>}
 {lista.map(c=><article key={c.id} className="editor-secao"><h2>{c.email_informado}</h2><p>Cadastro anterior: {c.nome_anterior} · {c.whatsapp_anterior??'WhatsApp não cadastrado'} · {c.compras_anteriores} compra(s).</p><p>Conta nova: {c.nome_novo} · {c.whatsapp_novo??'WhatsApp não cadastrado'}.</p><label htmlFor={`confirmacao-${c.id}`}>Como confirmou a titularidade pelo WhatsApp?</label><textarea id={`confirmacao-${c.id}`} className="input" value={registro[c.id]??''} onChange={e=>setRegistro(r=>({...r,[c.id]:e.target.value}))} maxLength={1000}/><button className="btn btn-p" disabled={ocupado} onClick={()=>vincular(c.id)}>Vincular compras confirmadas</button></article>)}
 </section>;
}
