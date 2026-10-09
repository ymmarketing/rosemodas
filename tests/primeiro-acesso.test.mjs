import {test} from 'node:test';import assert from 'node:assert/strict';import {handler} from '../supabase/functions/primeiro-acesso/fluxo.mjs';
const request=body=>new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json',origin:'https://rosemenezesmodas.com.br'},body:JSON.stringify(body)});
const dados={email:'admin@example.test',codigo:'123456',senha:'SenhaApenasFixture'};
test('código válido define senha, consome reserva e nunca autentica pelo código',async()=>{
 const calls=[];const h=handler({rpc:async(n,a)=>{calls.push([n,a]);return{data:n==='reservar_primeiro_acesso'?{user_id:'fixture',reserva:'lease'}:true};},auth:{admin:{updateUserById:async(id,d)=>{calls.push(['senha',id,d]);return{};}}}});
 const r=await h(request(dados));assert.equal(r.status,200);assert.equal(calls[1][2].password,dados.senha);assert.equal(calls[2][1].p_concluido,true);assert.deepEqual(await r.json(),{ok:true});
});
test('código inválido ou senha curta não altera Auth e falha do Auth libera reserva',async()=>{
 let mudou=0;const calls=[];const sb={rpc:async(n,a)=>{calls.push([n,a]);return{data:n==='reservar_primeiro_acesso'?null:true};},auth:{admin:{updateUserById:async()=>{mudou++;return{error:{}};}}}};
 assert.equal((await handler(sb)(request({...dados,senha:'curta'}))).status,400);assert.equal(calls.length,0);
 assert.equal((await handler(sb)(request(dados))).status,400);assert.equal(mudou,0);
 sb.rpc=async(n,a)=>{calls.push([n,a]);return{data:n==='reservar_primeiro_acesso'?{user_id:'fixture',reserva:'lease'}:true};};
 assert.equal((await handler(sb)(request(dados))).status,502);assert.equal(calls.at(-1)[1].p_concluido,false);
});
test('origem desconhecida e provisionamento sem ticket não criam admin',async()=>{
 const h=handler({rpc:async()=>({data:null})});const r=new Request('https://example.test',{method:'POST',headers:{origin:'https://outro.example.test'}});assert.equal((await h(r)).status,403);assert.equal((await h(request({acao:'provisionar',token:'invalido'}))).status,403);
});
