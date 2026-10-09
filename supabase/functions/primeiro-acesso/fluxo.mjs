// Nenhum código/senha/token é registrado. Autenticação própria, com RPCs restritas a service_role.
const origins=new Set(['https://rosemenezesmodas.com.br','https://www.rosemenezesmodas.com.br','https://homolog.rosemenezesmodas.com.br','http://127.0.0.1:5173']);
export function handler(sb){return async req=>{
 const origin=req.headers.get('origin');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Headers':'content-type,apikey,authorization,x-client-info,x-operador','Access-Control-Allow-Methods':'POST,OPTIONS',...(origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{})};
 const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{erro:'Origem não autorizada.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{erro:'Método não permitido.'});
 try{
  const tipo=req.headers.get('content-type')??'';
  if(tipo.startsWith('multipart/form-data')){
   const token=req.headers.get('x-operador')??'';
   const a=await sb.rpc('autorizar_operador_lancamento',{p_token:token});
   if(a.error||!a.data)return reply(403,{erro:'Operação não autorizada.'});
   const form=await req.formData();
   const files=form.getAll('arquivos'),paths=form.getAll('caminhos');
   if(!files.length){files.push(form.get('arquivo'));paths.push(form.get('caminho'));}
   const prefixo=`lancamento/${a.data.lote}/`;
   if(files.length>10||files.length!==paths.length||files.reduce((n,f)=>n+(f instanceof Blob?f.size:0),0)>20*1024*1024)return reply(400,{erro:'Lote de fotos inválido.'});
   for(let i=0;i<files.length;i++){
    const file=files[i],caminho=String(paths[i]??'');
    if(!(file instanceof Blob)||file.size>50*1024*1024||file.size===0||(!caminho.startsWith(prefixo)&&!['institucional/hero-lancamento-desktop.webp','institucional/hero-lancamento-mobile.webp'].includes(caminho))||caminho.includes('..')||!caminho.endsWith('.webp'))return reply(400,{erro:'Arquivo inválido.'});
   }
   const verificadas=[];
   const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
   for(let i=0;i<files.length;i++){
    const bytes=new Uint8Array(await files[i].arrayBuffer()),caminho=String(paths[i]),sha256=await hash(bytes);
    for(const bucket of ['catalogo-privado','produtos-publico']){
     const r=await sb.storage.from(bucket).upload(caminho,bytes,{contentType:'image/webp',upsert:false});
     if(r.error&&String(r.error.statusCode)!=='409')return reply(502,{erro:'Falha ao preparar a foto.'});
     const copy=await sb.storage.from(bucket).download(caminho);
     if(copy.error||await hash(new Uint8Array(await copy.data.arrayBuffer()))!==sha256)return reply(502,{erro:'Integridade da foto não confere.'});
    }
    verificadas.push({caminho,sha256,bytes:bytes.length});
   }
   return reply(200,{ok:true,verificadas});
  }
  if(Number(req.headers.get('content-length')??0)>4096)return reply(413,{erro:'Dados inválidos.'});
  const body=await req.json();
  if(body.acao==='provisionar'){
   const a=await sb.rpc('autorizar_operador_lancamento',{p_token:body.token??''});
   if(a.error||!a.data||a.data.admin_criado)return reply(403,{erro:'Operação não autorizada.'});
   const email=a.data.configuracao.email;
   const password=crypto.randomUUID()+crypto.randomUUID();
   const r=await sb.auth.admin.createUser({email,password,email_confirm:true});
   if(r.error)return reply(502,{erro:'Não foi possível criar a conta administrativa.'});
   const h=await sb.rpc('habilitar_admin_primeiro_acesso',{p_token:body.token,p_user_id:r.data.user.id});
   if(h.error||h.data!==true){await sb.auth.admin.updateUserById(r.data.user.id,{ban_duration:'876000h'});return reply(502,{erro:'Conta não habilitada. Requer revisão administrativa.'});}
   return reply(200,{ok:true,user_id:r.data.user.id});
  }
  if(typeof body.email!=='string'||typeof body.codigo!=='string'||!/^\d{6}$/.test(body.codigo)||typeof body.senha!=='string'||body.senha.length<8||body.senha.length>128)return reply(400,{erro:'Informe e-mail, código de 6 dígitos e senha de 8 a 128 caracteres.'});
  const r=await sb.rpc('reservar_primeiro_acesso',{p_email:body.email,p_codigo:body.codigo});
  if(r.error||!r.data)return reply(400,{erro:'Código inválido, já utilizado ou expirado. Confira os dados ou fale com a Yasmin.'});
  const {user_id,reserva}=r.data;
  const update=await sb.auth.admin.updateUserById(user_id,{password:body.senha,email_confirm:true});
  const fim=await sb.rpc('finalizar_primeiro_acesso',{p_user_id:user_id,p_reserva:reserva,p_concluido:!update.error});
  if(update.error||fim.error||fim.data!==true)return reply(502,{erro:'Não foi possível concluir. Tente novamente ou fale com a Yasmin.'});
  return reply(200,{ok:true});
 }catch{return reply(400,{erro:'Não foi possível concluir. Confira os dados e tente novamente.'});}
};}
