-- Construção: autorização da equipe, rascunho, fotos e publicação; tudo descartado.
begin;
create function pg_temp.checar(ok boolean,msg text) returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %',msg; end if;
end $$;
create function pg_temp.negado(comando text,codigo text default '42501') returns void language plpgsql as $$ begin
  begin execute comando; exception when others then if sqlstate=codigo then return; end if; raise; end;
  raise exception 'FAIL: operação proibida executou: %',comando;
end $$;
insert into auth.users(id) values ('11000000-0000-0000-0000-000000000001'),('11000000-0000-0000-0000-000000000002'),('11000000-0000-0000-0000-000000000003'),('11000000-0000-0000-0000-000000000004');
insert into public.usuarios_internos(user_id,nome,email,papel,ativo) values
 ('11000000-0000-0000-0000-000000000001','Admin fictício','admin@example.test','admin',true),
 ('11000000-0000-0000-0000-000000000003','Inativo fictício','inativo@example.test','estoque',false),
 ('11000000-0000-0000-0000-000000000004','Vendas fictício','vendas@example.test','vendas',true);
set local role anon;
do $$ begin
  perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$);
  perform pg_temp.negado($q$select * from public.usuarios_internos$q$);
  perform pg_temp.negado($q$select nome_sugerido from public.produtos$q$);
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000001","aal":"aal1","role":"authenticated"}',true);
do $$ begin
  perform pg_temp.checar((select count(user_id)=1 from public.usuarios_internos),'usuário lê somente seu acesso');
  perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$);
  perform pg_temp.negado($q$insert into storage.objects(bucket_id,name) values('produtos-publico','11000000-0000-0000-0000-000000000001/11000000-0000-0000-0000-000000000001.webp')$q$);
end $$;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000002","aal":"aal2","role":"authenticated","user_metadata":{"papel":"admin"}}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$); end $$;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000003","aal":"aal2","role":"authenticated"}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$); end $$;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000004","aal":"aal2","role":"authenticated"}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$); end $$;
reset role;
do $$ begin raise notice 'PASS: 13 autorização por tabela, MFA, papel, revogação e metadados falsos'; end $$;

insert into public.categorias(id,nome,slug) values('22000000-0000-0000-0000-000000000001','Teste curadoria','teste-curadoria');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000001","aal":"aal2","role":"authenticated"}',true);
select public.operar_catalogo('criar','44000000-0000-0000-0000-000000000001');
select public.operar_catalogo('criar','44000000-0000-0000-0000-000000000001');
do $$ declare r jsonb; begin
  r:=public.operar_catalogo('abrir','44000000-0000-0000-0000-000000000001');
  perform pg_temp.checar(r->>'status_catalogo'='rascunho' and not (r->>'ativo')::boolean and r->'preco'='null'::jsonb and r->'nome'='null'::jsonb,'rascunho sem preço/nome inventados');
  perform pg_temp.negado($q$select public.operar_catalogo('publicar','44000000-0000-0000-0000-000000000001')$q$,'23514');
  perform pg_temp.negado($q$update public.produtos set ativo=true where id='44000000-0000-0000-0000-000000000001'$q$);
end $$;
reset role;
do $$ begin
  perform pg_temp.checar((select count(*)=1 from public.produtos where id='44000000-0000-0000-0000-000000000001'),'criar é idempotente');
  raise notice 'PASS: 14 peça começa pelas fotos, sem dados comerciais fictícios ou escrita direta';
end $$;

set local role authenticated;
insert into storage.objects(bucket_id,name) values('produtos-publico','44000000-0000-0000-0000-000000000001/66000000-0000-0000-0000-000000000001.webp');
select public.operar_catalogo('midia_adicionar','44000000-0000-0000-0000-000000000001','{"id":"66000000-0000-0000-0000-000000000001","caminho_storage":"44000000-0000-0000-0000-000000000001/66000000-0000-0000-0000-000000000001.webp","tipo":"foto"}');
select public.operar_catalogo('midia_adicionar','44000000-0000-0000-0000-000000000001','{"id":"66000000-0000-0000-0000-000000000001","caminho_storage":"44000000-0000-0000-0000-000000000001/66000000-0000-0000-0000-000000000001.webp","tipo":"foto"}');
do $$ begin
  perform pg_temp.negado($q$insert into storage.objects(bucket_id,name) values('produtos-publico','99999999-0000-0000-0000-000000000001/66000000-0000-0000-0000-000000000001.webp')$q$);
  perform pg_temp.negado($q$select public.operar_catalogo('midia_adicionar','44000000-0000-0000-0000-000000000001','{"caminho_storage":"https://example.org/intrusa.jpg","tipo":"foto"}')$q$,'22023');
end $$;
reset role;
set local role anon;
do $$ begin
  perform pg_temp.checar((select count(id)=0 from public.produtos where id='44000000-0000-0000-0000-000000000001'),'rascunho invisível ao público');
  perform pg_temp.checar((select count(id)=0 from public.midias where produto_id='44000000-0000-0000-0000-000000000001'),'cadastro da mídia do rascunho invisível');
end $$;
reset role;
do $$ begin raise notice 'PASS: 15 upload só de equipe com MFA, sem URLs externas; rascunhos ocultos'; end $$;

set local role authenticated;
select public.operar_catalogo('salvar','44000000-0000-0000-0000-000000000001','{"nome":"Peça teste","preco":120,"categoria_id":"22000000-0000-0000-0000-000000000001","variacoes":[]}');
do $$ begin
  perform pg_temp.negado($q$select public.operar_catalogo('publicar','44000000-0000-0000-0000-000000000001')$q$,'23514');
  perform pg_temp.checar((public.operar_catalogo('abrir','44000000-0000-0000-0000-000000000001')->>'ativo')::boolean=false,'foto e preço não publicam sem tamanho, cor e quantidade');
end $$;
select public.operar_catalogo('salvar','44000000-0000-0000-0000-000000000001','{"nome":"Peça teste","preco":120,"categoria_id":"22000000-0000-0000-0000-000000000001","variacoes":[{"id":"55000000-0000-0000-0000-000000000001","tamanho":"48","cor":"Preto","quantidade":3}],"motivo_estoque":"Inventário fictício"}');
select public.operar_catalogo('publicar','44000000-0000-0000-0000-000000000001');
reset role;
set local role anon;
do $$ begin
  perform pg_temp.checar((select count(id)=1 from public.produtos where id='44000000-0000-0000-0000-000000000001'),'produto publicado visível');
  perform pg_temp.checar((select disponivel=3 from public.v_estoque_disponivel where variacao_id='55000000-0000-0000-0000-000000000001'),'saldo de publicado vem do ledger');
  perform pg_temp.negado($q$select custo_medio from public.variacoes$q$);
end $$;
reset role;
do $$ begin
  perform pg_temp.checar((select count(*)=1 from public.movimentos_estoque where variacao_id='55000000-0000-0000-0000-000000000001'),'único movimento inicial');
  perform pg_temp.checar(exists(select 1 from public.audit_log where entidade='movimentos_estoque' and usuario_id='11000000-0000-0000-0000-000000000001'),'autor do ajuste registrado');
  raise notice 'PASS: 16 salvar, SKU, estoque auditado, publicação e leitura pública';
end $$;

set local role authenticated;
do $$ begin
  perform pg_temp.negado($q$select public.operar_catalogo('salvar','44000000-0000-0000-0000-000000000001','{"atualizado_em":"2000-01-01T00:00:00Z"}')$q$,'40001');
  perform pg_temp.negado($q$select public.operar_catalogo('midia_arquivar','44000000-0000-0000-0000-000000000001','{"midia_id":"66000000-0000-0000-0000-000000000001"}')$q$,'23514');
  perform pg_temp.negado($q$select public.operar_catalogo('salvar','44000000-0000-0000-0000-000000000001','{"nome":"Peça teste","preco":120,"categoria_id":"22000000-0000-0000-0000-000000000001","variacoes":[{"id":"55000000-0000-0000-0000-000000000001","tamanho":"48","cor":"Preto","quantidade":-1}]}')$q$,'22023');
end $$;
select public.operar_catalogo('rascunho','44000000-0000-0000-0000-000000000001');
select public.operar_catalogo('salvar','44000000-0000-0000-0000-000000000001','{"nome":"Peça teste","preco":120,"categoria_id":"22000000-0000-0000-0000-000000000001","variacoes":[{"id":"55000000-0000-0000-0000-000000000001","tamanho":"48","cor":"Preto","quantidade":3}]}');
reset role;
do $$ begin
  perform pg_temp.checar((select count(*)=1 from public.movimentos_estoque where variacao_id='55000000-0000-0000-0000-000000000001'),'repetir quantidade não duplica movimento');
  perform pg_temp.checar(not exists(select 1 from pg_tables where schemaname='public' and tablename in ('clientes','pedidos','pagamentos','reservas_estoque','fornecedores')),'domínios futuros ausentes');
  raise notice 'PASS: 17 concorrência, validação de quantidade, retirada da vitrine e ausência de fases completas';
end $$;
set local role anon;
do $$ begin
  perform pg_temp.checar((select count(id)=0 from public.produtos where id='44000000-0000-0000-0000-000000000001'),'retirar esconde a peça do catálogo público');
  perform pg_temp.checar((select count(id)=0 from public.variacoes where produto_id='44000000-0000-0000-0000-000000000001'),'retirar esconde as variações do catálogo público');
end $$;
reset role;
rollback;
