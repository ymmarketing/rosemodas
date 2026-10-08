// Supabase Auth real, exclusivamente LOCAL e descartável. Sem senhas em código/logs.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import pg from 'pg';
const status=JSON.parse(execFileSync('node_modules/.bin/supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
const api=status.API_URL,key=status.PUBLISHABLE_KEY??status.ANON_KEY;
assert.ok(['127.0.0.1','localhost'].includes(new URL(api).hostname),'Teste recusa Auth hospedado.');
const url=process.env.SUPABASE_TEST_DATABASE_URL;
assert.ok(url&&['127.0.0.1','localhost'].includes(new URL(url).hostname),'Teste recusa banco hospedado.');
const db=new pg.Client({connectionString:url});await db.connect();
const requisicoes=[];
const cliente=()=>createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{requisicoes.push(new URL(input instanceof Request?input.url:String(input)).pathname);return fetch(input,init);}}});
const usuarios=[];
async function conta(rotulo){const sb=cliente(),email=`teste-${rotulo}-${randomUUID()}@example.test`,senha=randomBytes(28).toString('base64url');const {data,error}=await sb.auth.signUp({email,password:senha,options:{data:{role:'admin'}}});assert.ifError(error);assert.ok(data.session,'Cadastro deve liberar sessão imediatamente.');usuarios.push(data.user.id);return{sb,email,senha,id:data.user.id};}
const aprovado=[];
try{
  const settings=await fetch(api+'/auth/v1/settings',{headers:{apikey:key}}).then(r=>r.json());assert.equal(settings.mailer_autoconfirm,true);
  const admin=await conta('admin'),a=await conta('a'),b=await conta('b');
  assert.equal((await a.sb.rpc('meu_acesso')).data.role,'cliente');
  await db.query('insert into public.usuarios_internos(user_id,nome,email,papel) values($1,$2,$3,$4)',[admin.id,'Admin fictícia API',admin.email,'admin']);
  assert.equal((await admin.sb.rpc('meu_acesso')).data.admin_autorizado,true);
  assert.ok((await admin.sb.rpc('operar_catalogo',{p_acao:'listar'})).data.itens);
  aprovado.push('Admin por senha e cliente por cadastro imediato, sem confirmação de e-mail.');
  assert.equal((await a.sb.rpc('meu_acesso')).data.admin_autorizado,false);
  assert.ok((await a.sb.rpc('operar_catalogo',{p_acao:'listar'})).error);
  assert.ok((await a.sb.from('profiles').update({role:'admin'}).eq('user_id',a.id)).error);
  aprovado.push('Cliente bloqueada na RPC administrativa e na promoção do próprio papel.');
  const categoria=randomUUID(),produto=randomUUID(),variacao=randomUUID(),pedidoA=randomUUID(),pedidoB=randomUUID();
  await db.query('insert into public.categorias(id,nome,slug) values($1,$2,$3)',[categoria,'Categoria fictícia API',`teste-${categoria}`]);
  await db.query('insert into public.produtos(id,codigo,nome,slug,categoria_id,preco,ativo) values($1,$2,$3,$4,$5,10,false)',[produto,`TESTE-${produto}`,'Peça fictícia API',`teste-${produto}`,categoria]);
  await db.query('insert into public.variacoes(id,produto_id,sku,tamanho,cor) values($1,$2,$3,$4,$5)',[variacao,produto,`TESTE-${variacao}`,'48','Fictícia']);
  for(const [pedido,u] of [[pedidoA,a],[pedidoB,b]]){
    await db.query('insert into public.pedidos(id,numero,cliente_id,canal,subtotal,total) select $1,$2,id,$3,10,10 from public.clientes where auth_user_id=$4',[pedido,`TESTE-${pedido}`,'whatsapp',u.id]);
    await db.query('insert into public.itens_pedido(pedido_id,produto_id,variacao_id,sku_snapshot,nome_snapshot,cor_snapshot,tamanho_snapshot,preco_unitario,quantidade,total_item) values($1,$2,$3,$4,$5,$6,$7,10,1,10)',[pedido,produto,variacao,'TESTE','Peça fictícia','Fictícia','48']);
    await db.query('insert into public.enderecos_pedido(pedido_id,nome_destinatario,cep,rua,numero,bairro,cidade,uf) values($1,$2,$3,$4,$5,$6,$7,$8)',[pedido,'Cliente fictícia','00000000','Rua fictícia','0','Bairro fictício','Cidade fictícia','MG']);
    const envio=randomUUID();await db.query('insert into public.envios(id,pedido_id,tipo,servico) values($1,$2,$3,$4)',[envio,pedido,'saida','pac']);
    await db.query('insert into public.eventos_envio(envio_id,codigo,descricao,data_evento) values($1,$2,$3,now())',[envio,'TESTE','Evento fictício API']);
  }
  for(const [u,proprio,outro] of [[a,pedidoA,pedidoB],[b,pedidoB,pedidoA]]){
    const r=await u.sb.from('pedidos').select('id');assert.ifError(r.error);assert.deepEqual(r.data.map(p=>p.id),[proprio]);
    assert.deepEqual((await u.sb.from('pedidos').select('id').eq('id',outro)).data,[]);
    for(const tabela of ['itens_pedido','envios','eventos_envio'])assert.equal((await u.sb.from(tabela).select('id')).data.length,1);
    assert.equal((await u.sb.from('enderecos_pedido').select('pedido_id')).data.length,1);
    assert.ok((await u.sb.from('itens_pedido').select('custo_unitario_snapshot')).error);
  }
  assert.equal((await admin.sb.from('pedidos').select('id')).data.length,2);
  aprovado.push('A/B isoladas em pedidos, itens, endereços, envios e eventos; admin vê ambos.');
  for(let i=0;i<10;i++){const r=await admin.sb.auth.signInWithPassword({email:admin.email,password:admin.senha});assert.ifError(r.error);assert.ok(r.data.session);}
  aprovado.push('10 logins consecutivos por senha sem bloqueio.');
  assert.ok(!requisicoes.some(p=>/\/auth\/v1\/(otp|recover|resend|verify)$/.test(p)));
  aprovado.push('Nenhuma chamada para OTP, magic link, SMS ou recuperação por e-mail.');
  await mkdir('test-results',{recursive:true});await writeFile('test-results/auth-api-local.json',JSON.stringify({ambiente:'supabase-local-descartavel',aprovado,usuarios_ficticios:usuarios.length},null,2));
  console.log(`PASS: Auth API local — ${aprovado.length} grupos; senhas geradas em memória, sem credenciais no relatório.`);
}finally{await db.end();}
