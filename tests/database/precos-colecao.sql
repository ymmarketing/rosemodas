-- Bloco 1: preço promocional, constraint preservada e coleção padrão. Sem dados persistentes.
begin;
create or replace function pg_temp.checar(ok boolean,msg text) returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %',msg; end if;
end $$;
insert into auth.users(id) values ('11000000-0000-0000-0000-000000000007');
insert into public.usuarios_internos(user_id,nome,email,papel,ativo)
  values ('11000000-0000-0000-0000-000000000007','Teste de preço','preco@example.test','admin',true);
insert into public.colecoes(id,nome,slug,atual) values
  ('33000000-0000-0000-0000-000000000007','Atual fictícia','atual-ficticia',true),
  ('33000000-0000-0000-0000-000000000008','Outra fictícia','outra-ficticia',false);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000007","aal":"aal2","role":"authenticated"}',true);
do $$ declare r jsonb; begin
  r:=public.operar_catalogo('criar','44000000-0000-0000-0000-000000000007');
  perform pg_temp.checar(r->>'colecao_id'='33000000-0000-0000-0000-000000000007','rascunho nasce na coleção atual');
  r:=public.operar_catalogo('salvar','44000000-0000-0000-0000-000000000007','{"nome":"Teste de preço","colecao_id":"33000000-0000-0000-0000-000000000008","preco":120,"preco_promocional":null}');
  perform pg_temp.checar((r->>'preco')::numeric=120 and r->'preco_promocional'='null'::jsonb,'promoção vazia salva preço normal');
  r:=public.operar_catalogo('salvar','44000000-0000-0000-0000-000000000007','{"nome":"Teste de preço","colecao_id":"33000000-0000-0000-0000-000000000008","preco":120,"preco_promocional":99.90}');
  perform pg_temp.checar((r->>'preco_promocional')::numeric=99.90,'promoção menor salva');
  begin
    perform public.operar_catalogo('salvar','44000000-0000-0000-0000-000000000007','{"nome":"Não deve salvar","preco":120,"preco_promocional":120}');
    raise exception 'FAIL: promoção igual aceita';
  exception when check_violation then
    perform pg_temp.checar(sqlerrm like 'O preço promocional deve ser menor%','promoção igual explica como corrigir');
  end;
  r:=public.operar_catalogo('abrir','44000000-0000-0000-0000-000000000007');
  perform pg_temp.checar(r->>'nome'='Teste de preço' and (r->>'preco_promocional')::numeric=99.90,'erro não modifica dados salvos');
  perform public.operar_catalogo('criar','44000000-0000-0000-0000-000000000007');
  r:=public.operar_catalogo('abrir','44000000-0000-0000-0000-000000000007');
  perform pg_temp.checar(r->>'colecao_id'='33000000-0000-0000-0000-000000000008','repetir criação preserva coleção escolhida');
end $$;
reset role;
do $$ begin
  begin
    update public.produtos set preco_promocional=preco where id='44000000-0000-0000-0000-000000000007';
    raise exception 'FAIL: constraint do banco removida';
  exception when check_violation then null; end;
  update public.colecoes set atual=false where id='33000000-0000-0000-0000-000000000007';
end $$;
set local role authenticated;
do $$ declare r jsonb; begin
  r:=public.operar_catalogo('criar','44000008-0000-0000-0000-000000000008');
  perform pg_temp.checar(r->'colecao_id'='null'::jsonb,'sem coleção atual não inventa relação');
  raise notice 'PASS: 20 promoção vazia, menor e igual, mensagem amigável, constraint e coleção padrão';
end $$;
reset role;
rollback;
