// Nenhum token, IP, cabeçalho, CEP ou resposta bruta do provedor é registrado.
export const erroPublico='Não conseguimos calcular agora. Consulte o frete pelo WhatsApp';
const motivos={TOKEN_AUSENTE:'Token não configurado. Cadastre MELHOR_ENVIO_TOKEN nos Secrets do Supabase.',TOKEN_INVALIDO:'Token inválido ou expirado.',API_ERRO:'A API de frete está indisponível.',TIMEOUT:'A cotação demorou demais. Tente novamente.',SEM_RESULTADO:'Não há PAC ou SEDEX disponível para este CEP.',CONFIGURACAO:'Confira as configurações de embalagem e postagem.'};
export function vencimentoToken(token){
 try{const partes=token.split('.');if(partes.length!==3)return null;const texto=atob(partes[1].replace(/-/g,'+').replace(/_/g,'/'));const exp=JSON.parse(texto).exp;return typeof exp==='number'&&Number.isFinite(exp)&&exp>0?new Date(exp*1000).toISOString():null;}catch{return null;}
}
export async function hash(texto){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(texto)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export function baseValida(base){const u=new URL(base);if(u.protocol!=='https:'||!['melhorenvio.com.br','www.melhorenvio.com.br','sandbox.melhorenvio.com.br'].includes(u.hostname)||u.username||u.password||u.search||u.hash||u.port||!['','/','/api/v2','/api/v2/'].includes(u.pathname))throw new Error('CONFIGURACAO');return `${u.origin}/api/v2`;}
export function normalizarServicos(resposta,dias){
 if(!Array.isArray(resposta))return [];
 return resposta.flatMap(s=>{
  const id=Number(s?.id),nome=id===1?'PAC':id===2?'SEDEX':null;
  const valor=Number(s.custom_price??s.price),prazo=Number(s.custom_delivery_range?.max??s.custom_delivery_time??s.delivery_range?.max??s.delivery_time);
  if(!nome||s.error||s.company?.name!=='Correios'||!Number.isFinite(valor)||valor<=0||!Number.isInteger(prazo)||prazo<0||s.custom_price===''||s.price===null)return [];
  return [{id,servico:nome,valor:Math.round(valor*100)/100,prazo_dias: prazo+dias}];
 }).sort((a,b)=>a.valor-b.valor||a.id-b.id);
}
export function criarHandler({rpc,autorizarPublico,autorizarAdmin,token='',base='https://melhorenvio.com.br/api/v2',salt,fetcher=fetch,timeoutMs=8000,agora=()=>Date.now()}){
 const origins=new Set(['https://homolog.rosemenezesmodas.com.br','https://rosemodas-painel-homologacao.vercel.app','https://rosemenezesmodas.com.br','https://www.rosemenezesmodas.com.br','http://127.0.0.1:5173']);
 const originPermitida=o=>!o||origins.has(o)||/^https:\/\/rosemodas-homologacao-[a-z0-9]+-ym-marketing-negocios\.vercel\.app$/.test(o);
 return async req=>{
  const origin=req.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Headers':'content-type,apikey,authorization,x-client-info','Access-Control-Allow-Methods':'POST,GET,OPTIONS',...(origin&&originPermitida(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{})};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(!originPermitida(origin))return reply(403,{ok:false,erro:erroPublico});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['GET','POST'].includes(req.method))return reply(405,{ok:false,erro:erroPublico});
  let admin=false;
  try{
   if(!await autorizarPublico(req))return reply(401,{ok:false,erro:erroPublico});
   const bearer=req.headers.get('authorization');
   if(bearer?.startsWith('Bearer ')&&!bearer.includes('sb_publishable_'))admin=await autorizarAdmin(bearer.slice(7));
   if(req.method==='GET'){
    if(!admin)return reply(403,{ok:false,erro:erroPublico});
    return reply(200,{ok:true,configurado:!!token,expira_em:vencimentoToken(token)});
   }
   // Cloudflare sobrescreve cf-connecting-ip. No fallback, usa o último salto anexado pelo proxy.
   const ip=req.headers.get('cf-connecting-ip')??req.headers.get('x-real-ip')??req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()??'sem-ip';
   const limite=await rpc('limite',await hash(`${salt}:${ip}`));
   if(!limite?.permitido)return reply(429,{ok:false,erro:erroPublico,...(admin?{detalhe:'Limite de 20 cotações por minuto. Aguarde um minuto.'}:{})});
   if(Number(req.headers.get('content-length')??0)>1024)return reply(400,{ok:false,erro:erroPublico});
   const raw=await req.text();if(raw.length>1024)return reply(400,{ok:false,erro:erroPublico});
   let body;try{body=JSON.parse(raw);}catch{return reply(400,{ok:false,erro:'Confira o CEP'});}
   if(!body||typeof body.cep!=='string'||!/^\d{8}$/.test(body.cep))return reply(400,{ok:false,erro:'Confira o CEP'});
   if(Object.keys(body).some(k=>!['cep','codigo','variacao'].includes(k))||typeof body.codigo!=='string'||!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(body.codigo)||body.codigo.length>64||(body.variacao!=null&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(body.variacao)))return reply(400,{ok:false,erro:erroPublico});
   const p=await rpc('dados',body.codigo,{variacao:body.variacao??null});
   if(!p)return reply(404,{ok:false,erro:erroPublico});
   if(!token)throw new Error('TOKEN_AUSENTE');
   const exp=vencimentoToken(token);if(exp&&Date.parse(exp)<=agora())throw new Error('TOKEN_INVALIDO');
   const url=baseValida(base),dias=Number(p.dias_postagem);
   if(!/^\d{8}$/.test(p.cep_origem)||!Number.isInteger(dias)||dias<0||dias>30||!['preco','peso_g','largura_cm','altura_cm','comprimento_cm'].every(k=>Number.isFinite(Number(p[k]))&&Number(p[k])>0))throw new Error('CONFIGURACAO');
   const key=await hash(JSON.stringify([body.cep,p,url,await hash(token)]));
   const cache=await rpc('cache_ler',key);if(cache&&Date.parse(cache.expira_em)>agora())return reply(200,cache);
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
   let result;
   try{
    const r=await fetcher(`${url}/me/shipment/calculate`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`,'User-Agent':'Rose Modas (y.menezessilva@gmail.com)'},redirect:'error',signal:controller.signal,body:JSON.stringify({from:{postal_code:p.cep_origem},to:{postal_code:body.cep},products:[{id:p.codigo,width:Number(p.largura_cm),height:Number(p.altura_cm),length:Number(p.comprimento_cm),weight:Number(p.peso_g)/1000,insurance_value:Number(p.preco),quantity:1}],options:{receipt:false,own_hand:false},services:'1,2'})});
    if([401,403].includes(r.status))throw new Error('TOKEN_INVALIDO');
    if(!r.ok)throw new Error('API_ERRO');
    result=await r.json();
   }catch(e){if(controller.signal.aborted||e?.name==='AbortError')throw new Error('TIMEOUT');throw e;}finally{clearTimeout(timer);}
   const opcoes=normalizarServicos(result,dias);if(!opcoes.length)throw new Error('SEM_RESULTADO');
   const cotacao={ok:true,cep:body.cep,codigo:p.codigo,opcoes,expira_em:new Date(agora()+3600000).toISOString()};
   await rpc('cache_gravar',key,cotacao);
   return reply(200,cotacao);
  }catch(e){return reply(200,{ok:false,erro:erroPublico,...(admin?{detalhe:motivos[e?.message]??'Não foi possível calcular o frete.'}:{})});}
 };
}
