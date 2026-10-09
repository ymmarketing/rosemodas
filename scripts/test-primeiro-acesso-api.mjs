// Exercita o mesmo handler da Edge Function contra Auth e banco LOCAL descartável.
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import {writeFile} from 'node:fs/promises';import {createClient} from '@supabase/supabase-js';import pg from 'pg';import {handler} from '../supabase/functions/primeiro-acesso/fluxo.mjs';
const s=JSON.parse(execFileSync('node_modules/.bin/supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
assert.ok(['localhost','127.0.0.1'].includes(new URL(s.API_URL).hostname));assert.ok(['localhost','127.0.0.1'].includes(new URL(process.env.SUPABASE_TEST_DATABASE_URL).hostname));
const db=new pg.Client({connectionString:process.env.SUPABASE_TEST_DATABASE_URL});await db.connect();
const sb=createClient(s.API_URL,s.SERVICE_ROLE_KEY??s.SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),h=handler(sb);
const hash=x=>createHash('sha256').update(x).digest('hex'),token=randomBytes(32).toString('hex'),sal=randomBytes(32).toString('hex'),codigo='654321',email=`primeiro-${randomUUID()}@example.test`,senha=randomBytes(20).toString('hex');
const req=b=>new Request(s.API_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
const aprovado=[];
try{
 await db.query('insert into private.operadores_lancamento(token_hash,lote,expira_em,configuracao) values($1,$2,now()+interval \'1 hour\',$3)',[hash(token),randomUUID(),JSON.stringify({email,nome:'Admin fictícia CI',sal,codigo_hash:hash(sal+codigo)})]);
 const provision=await h(req({acao:'provisionar',token}));assert.equal(provision.status,200);const uid=(await provision.json()).user_id;
 assert.equal((await db.query('select role from public.profiles where user_id=$1',[uid])).rows[0].role,'admin');assert.equal((await db.query('select count(*)::int n from public.clientes where auth_user_id=$1 and ativo',[uid])).rows[0].n,0);
 assert.equal((await h(req({acao:'provisionar',token}))).status,403);aprovado.push('Provisionamento confirmado sem email, admin por banco, sem cliente ativo e ticket de criação usado uma vez.');
 assert.equal((await h(req({email,codigo:'000000',senha}))).status,400);assert.equal((await h(req({email,codigo,senha:'curta'}))).status,400);
 const first=await h(req({email,codigo,senha}));assert.equal(first.status,200);assert.equal((await h(req({email,codigo,senha}))).status,400);
 const login=await createClient(s.API_URL,s.PUBLISHABLE_KEY??s.ANON_KEY,{auth:{persistSession:false}}).auth.signInWithPassword({email,password:senha});assert.ifError(login.error);assert.equal(login.data.user.id,uid);assert.equal((await db.query('select precisa_definir_senha from public.usuarios_internos where user_id=$1',[uid])).rows[0].precisa_definir_senha,false);aprovado.push('Senha própria definida, login por senha e código consumido/reutilização bloqueada.');

 const publicSb=createClient(s.API_URL,s.PUBLISHABLE_KEY??s.ANON_KEY,{auth:{persistSession:false}});assert.ok((await publicSb.rpc('reservar_primeiro_acesso',{p_email:email,p_codigo:codigo})).error);aprovado.push('RPC de código inacessível para anon/clientes.');
 await db.query('update public.usuarios_internos set precisa_definir_senha=true where user_id=$1',[uid]);await db.query('update private.primeiro_acesso_admin set usado_em=null,expira_em=now()-interval \'1 second\' where user_id=$1',[uid]);
 assert.equal((await h(req({email,codigo,senha}))).status,400);await db.query('update private.primeiro_acesso_admin set expira_em=now()+interval \'7 days\',tentativas=10,janela_em=now() where user_id=$1',[uid]);assert.equal((await h(req({email,codigo,senha}))).status,400);aprovado.push('Expiração de sete dias e limite de tentativas aplicados pelo banco.');
 await writeFile('test-results/primeiro-acesso-api-local.json',JSON.stringify({ambiente:'supabase-local-descartavel',aprovado},null,2));console.log(`PASS: Primeiro acesso API local — ${aprovado.length} grupos; sem credenciais no relatório.`);
}finally{await db.end();}
