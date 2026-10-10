import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {criarHandler} from './fluxo.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const serverKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
let publishable:string[]=[];
try{publishable=Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')??'{}'));}catch{/* fail closed; validates against the gateway below */}
const anon=Deno.env.get('SUPABASE_ANON_KEY');if(anon)publishable.push(anon);
async function autorizarPublico(req:Request){
 const key=req.headers.get('apikey');if(!key)return false;
 if(publishable.includes(key))return true;
 // A gateway validates the configured project's publishable key; never a client price or token.
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return false;
 const r=await fetch(`${url}/rest/v1/configuracoes?select=chave&limit=1`,{method:'HEAD',headers:{apikey:key},signal:AbortSignal.timeout(3000)});
 return r.ok;
}
async function autorizarAdmin(jwt:string){
 const {data,error}=await sb.auth.getUser(jwt);if(error||!data.user)return false;
 const client=createClient(url,anon??publishable[0],{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const r=await client.rpc('configurar_frete',{p_acao:'ler'});return !r.error;
}
async function rpc(acao:string,chave='',dados={}){const r=await sb.rpc('frete_servidor',{p_acao:acao,p_chave:chave,p_dados:dados});if(r.error)throw new Error('BANCO');return r.data;}
Deno.serve(criarHandler({rpc,autorizarPublico,autorizarAdmin,token:Deno.env.get('MELHOR_ENVIO_TOKEN')??'',base:Deno.env.get('MELHOR_ENVIO_API_URL')??'https://melhorenvio.com.br/api/v2',salt:serverKey}));
