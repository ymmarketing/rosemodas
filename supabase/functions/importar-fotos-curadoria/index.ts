// Importação operacional pelo servidor, com autorização temporária limitada aos
// hashes/arquivos do lote revisado e ao convite da conta escolhida pela Yasmin.
// Não altera preços nem estoque.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

Deno.serve(async req => {
  const responder=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method!=='POST')return responder(405,{error:'Método inválido'});
  const token=req.headers.get('x-import-token')??'';
  if(!/^[0-9a-f]{64}$/.test(token))return responder(403,{error:'Importação não autorizada'});
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:config,error:falha}=await sb.from('configuracoes').select('valor').eq('chave','catalogo_importacao_drive').maybeSingle();
  const lote=config?.valor;
  const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
  const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
  if(falha||!lote?.ativo||lote.token_hash!==digest||!Number.isFinite(Date.parse(lote.expira_em))||Date.parse(lote.expira_em)<=Date.now()
    ||lote.project_ref!=='kernpudxhwkpoadahgqj'||!Deno.env.get('SUPABASE_URL')?.includes('kernpudxhwkpoadahgqj.supabase.co'))
    return responder(403,{error:'Importação não autorizada'});
  // Habilitação apenas da conta explicitamente escolhida pela Yasmin.
  const acesso=req.headers.get('x-setup-access');
  if(acesso&&lote.admin_email==='y.menezessilva@gmail.com'){
    const redirectTo='https://rosemodas-painel-homologacao.vercel.app/';
    if(acesso==='verificar'){
      const {data,error}=await sb.auth.admin.generateLink({type:'invite',email:lote.admin_email,options:{redirectTo}});
      if(error)return responder(500,{error:'Não foi possível preparar o acesso'});
      return responder(200,{ok:true,user_id:data.user.id,redirect_configurado:new URL(data.properties.action_link).searchParams.get('redirect_to')===redirectTo});
    }
    if(acesso==='convidar'){
      const {data:link,error:falhaLink}=await sb.auth.admin.generateLink({type:'invite',email:lote.admin_email,options:{redirectTo}});
      if(falhaLink||new URL(link.properties.action_link).searchParams.get('redirect_to')!==redirectTo)
        return responder(409,{error:'Configure a URL de retorno do painel antes de enviar o convite'});
      const {data,error}=await sb.auth.admin.inviteUserByEmail(lote.admin_email,{redirectTo});
      if(error)return responder(500,{error:'Não foi possível enviar o convite'});
      return responder(200,{ok:true,user_id:data.user.id,convite_enviado:true});
    }
    return responder(400,{error:'Operação inválida'});
  }
  const id=req.headers.get('x-file-id')??'',asset=lote.arquivos?.[id];
  if(!asset||req.headers.get('content-type')!=='image/webp'||Number(req.headers.get('content-length'))!==asset.bytes)
    return responder(400,{error:'Arquivo fora do lote autorizado'});
  const {data:produto}=await sb.from('produtos').select('id,status_catalogo,ativo,arquivado_em').eq('id',asset.produto_id).maybeSingle();
  if(!produto||produto.status_catalogo!=='rascunho'||produto.ativo||produto.arquivado_em)
    return responder(409,{error:'A peça precisa estar em rascunho'});
  const bytes=await req.arrayBuffer();
  if(bytes.byteLength!==asset.bytes||hex(await crypto.subtle.digest('SHA-256',bytes))!==asset.sha256)
    return responder(400,{error:'Conteúdo diferente do arquivo autorizado'});
  const {error:upload}=await sb.storage.from('produtos-publico').upload(asset.caminho_storage,bytes,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});
  if(upload){
    const {data:existente,error}=await sb.storage.from('produtos-publico').download(asset.caminho_storage);
    if(error||!existente||hex(await crypto.subtle.digest('SHA-256',await existente.arrayBuffer()))!==asset.sha256)
      return responder(500,{error:'Falha no envio do arquivo'});
  }
  const {error}=await sb.from('midias').upsert({id:asset.id,produto_id:asset.produto_id,caminho_storage:asset.caminho_storage,
    tipo:'foto',alt_texto:asset.alt_texto,ordem:asset.ordem,principal:asset.principal,ativo:true,
    origem_arquivo_id:`drive:${id}`,arquivo_nome_original:asset.arquivo_nome_original},{onConflict:'id',ignoreDuplicates:true});
  if(error)return responder(500,{error:'Arquivo enviado, mas registro de mídia não concluído'});
  return responder(200,{ok:true,arquivo:id});
});
