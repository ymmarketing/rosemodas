import {validarAmbiente} from './ambiente';
export type OpcaoFrete={id:number;servico:'PAC'|'SEDEX';valor:number;prazo_dias:number};
export type CotacaoFrete={ok:true;cep:string;codigo:string;opcoes:OpcaoFrete[];expira_em:string};
export type FreteEscolhido=OpcaoFrete&{cep:string;expira_em:string};
export const cepLimpo=(valor:string)=>valor.replace(/\D/g,'').slice(0,8);
export function mascaraCep(valor:string){const cep=cepLimpo(valor);return cep.length>5?`${cep.slice(0,5)}-${cep.slice(5)}`:cep;}
export function lembrarCep(cep?:string){try{if(cep!==undefined)localStorage.setItem('rosemodas:cep',cepLimpo(cep));return mascaraCep(localStorage.getItem('rosemodas:cep')??'');}catch{return '';}}
const erroFrete='Não conseguimos calcular agora. Consulte o frete pelo WhatsApp';
export async function chamarFrete(dados:{cep:string;codigo:string;variacao:string|null}|null,jwt?:string,signal?:AbortSignal){
 const ambiente=validarAmbiente(import.meta.env,true);if(!ambiente)throw new Error(erroFrete);
 try{
  const r=await fetch(`${ambiente.url}/functions/v1/cotar-frete`,{method:dados?'POST':'GET',headers:{apikey:ambiente.chave,...(jwt?{Authorization:`Bearer ${jwt}`} :{}),...(dados?{'Content-Type':'application/json'}:{})},body:dados?JSON.stringify(dados):undefined,signal:signal??AbortSignal.timeout(12000)});
  const data=await r.json();
  if(!r.ok||!data.ok)throw new Error(data.detalhe??data.erro??erroFrete);
  return data;
 }catch(e){if(e instanceof Error&&(e.message==='Confira o CEP'||e.message===erroFrete||jwt))throw e;throw new Error(erroFrete);}
}
export async function cotarFrete(cep:string,codigo:string,variacao:string|null,jwt?:string,signal?:AbortSignal):Promise<CotacaoFrete>{return chamarFrete({cep:cepLimpo(cep),codigo,variacao},jwt,signal);}
export function trechoFreteWhatsApp(frete?:FreteEscolhido|null){
 if(!frete||Date.parse(frete.expira_em)<=Date.now()||!/^\d{8}$/.test(frete.cep))return '';
 return `\nFrete informativo: CEP ${mascaraCep(frete.cep)} · ${frete.servico} · ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(frete.valor)} · até ${frete.prazo_dias} dias úteis.`;
}
