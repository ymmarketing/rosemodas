import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {cotarFrete,cepLimpo,lembrarCep,mascaraCep} from './frete';
import type {CotacaoFrete,FreteEscolhido} from './frete';
import {moeda} from './Visual';
export function CalculadoraFrete({codigo,variacao,escolheu,consultar,cotar=cotarFrete}:{codigo:string;variacao:string|null;escolheu:(f:FreteEscolhido|null)=>void;consultar:()=>void;cotar?:typeof cotarFrete}){
 const [cep,setCep]=useState(lembrarCep),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState(''),[cotacao,setCotacao]=useState<CotacaoFrete|null>(null),[servico,setServico]=useState<number|null>(null);
 const pedido=useRef(0),controller=useRef<AbortController|null>(null),callback=useRef(escolheu);callback.current=escolheu;
 function limpar(){pedido.current++;controller.current?.abort();setCotacao(null);setServico(null);setErro('');setOcupado(false);callback.current(null);}
 useEffect(()=>{limpar();return()=>{pedido.current++;controller.current?.abort();};},[codigo,variacao]);
 useEffect(()=>{if(!cotacao)return;const tempo=Date.parse(cotacao.expira_em)-Date.now();const t=setTimeout(()=>{limpar();setErro('Calcule novamente para atualizar o frete.');},Math.max(0,tempo));return()=>clearTimeout(t);},[cotacao]);
 async function calcular(e:FormEvent){
  e.preventDefault();limpar();if(cepLimpo(cep).length!==8){setErro('Confira o CEP');return;}
  const id=++pedido.current;controller.current=new AbortController();setOcupado(true);
  const timeout=setTimeout(()=>controller.current?.abort(),12000);
  try{const resultado=await cotar(cep,codigo,variacao,undefined,controller.current.signal);if(pedido.current===id)setCotacao(resultado);}
  catch(e){if(pedido.current===id)setErro(e instanceof Error?e.message:'Não conseguimos calcular agora. Consulte o frete pelo WhatsApp');}
  finally{clearTimeout(timeout);if(pedido.current===id)setOcupado(false);}
 }
 return <div className="blk calculadora-frete"><form onSubmit={calcular} noValidate><label htmlFor={`cep-${codigo}`}>Calcular frete</label><div className="frete-entrada"><input id={`cep-${codigo}`} className="input" type="text" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} value={cep} onChange={e=>{limpar();const valor=mascaraCep(e.target.value);setCep(valor);lembrarCep(valor);}}/><button className="btn btn-s" type="submit" disabled={ocupado}>{ocupado?'Calculando…':'Calcular'}</button></div></form>
  <div aria-live="polite" aria-atomic="true">{erro&&<p className="frete-erro" role="alert">{erro}</p>}{cotacao&&<fieldset className="frete-opcoes"><legend>Escolha o frete para incluir no WhatsApp</legend>{cotacao.opcoes.map(o=><label key={o.id} className={servico===o.id?'selecionado':''}><input type="radio" name={`frete-${codigo}`} value={o.id} checked={servico===o.id} onChange={()=>{setServico(o.id);callback.current({...o,cep:cotacao.cep,expira_em:cotacao.expira_em});}}/><span>{o.servico} · {moeda(o.valor)} · até {o.prazo_dias} dias úteis</span></label>)}{servico!==null&&<button type="button" className="frete-limpar" onClick={()=>{setServico(null);callback.current(null);}}>Enviar sem frete</button>}<p className="small muted">Cotação informativa. A compra é finalizada pelo WhatsApp.</p></fieldset>}</div>
  <p className="small">Frete e prazo: consulte pelo WhatsApp</p><button type="button" className="btn btn-s" onClick={consultar}>Consultar frete pelo WhatsApp</button>
 </div>;
}
