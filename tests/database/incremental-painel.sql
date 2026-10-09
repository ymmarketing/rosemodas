begin;
create function pg_temp.assert_incremental(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL incremental: %',msg;end if;end$$;
insert into auth.users(id,email) values('15000000-0000-4000-8000-000000000001','incremental-admin@example.test');
insert into public.usuarios_internos(user_id,nome,email,papel) values('15000000-0000-4000-8000-000000000001','Admin CI','incremental-admin@example.test','admin');
insert into public.categorias(id,nome,slug) values('25000000-0000-4000-8000-000000000001','Vestidos incremental','vestidos-incremental');
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","amr":[{"method":"password"}]}',true);
create temporary table incremental_ctx(p jsonb,manifesto jsonb,lote uuid);
grant all on incremental_ctx to authenticated;
set local role authenticated;
insert into incremental_ctx(p) select public.operar_catalogo('criar','45000000-0000-4000-8000-000000000001','{"codigo":"RM-MANUAL-CI"}','95000000-0000-4000-8000-000000000001');
update incremental_ctx set p=public.operar_catalogo('salvar',(p->>'id')::uuid,jsonb_build_object('nome','Peça real manual','categoria_id','25000000-0000-4000-8000-000000000001','preco',100,'variacoes',jsonb_build_array(jsonb_build_object('id','55000000-0000-4000-8000-000000000001','cor','Azul','tamanho','P','quantidade',2)),'motivo_estoque','Estoque real CI'),'95000000-0000-4000-8000-000000000001');
reset role;
insert into storage.objects(bucket_id,name) values('produtos-publico','45000000-0000-4000-8000-000000000001/65000000-0000-4000-8000-000000000001.webp'),('produtos-publico','45000000-0000-4000-8000-000000000001/65000000-0000-4000-8000-000000000002.webp');
set local role authenticated;
update incremental_ctx set p=public.operar_catalogo('midia_adicionar',(p->>'id')::uuid,'{"id":"65000000-0000-4000-8000-000000000001","caminho_storage":"45000000-0000-4000-8000-000000000001/65000000-0000-4000-8000-000000000001.webp","tipo":"foto"}','95000000-0000-4000-8000-000000000001');
update incremental_ctx set p=public.operar_catalogo('midia_adicionar',(p->>'id')::uuid,'{"id":"65000000-0000-4000-8000-000000000002","caminho_storage":"45000000-0000-4000-8000-000000000001/65000000-0000-4000-8000-000000000002.webp","tipo":"foto"}','95000000-0000-4000-8000-000000000001');
update incremental_ctx set p=public.operar_catalogo('midia_ordenar',(p->>'id')::uuid,'{"ids":["65000000-0000-4000-8000-000000000002","65000000-0000-4000-8000-000000000001"]}','95000000-0000-4000-8000-000000000001');
update incremental_ctx set p=public.operar_catalogo('midia_capa',(p->>'id')::uuid,'{"midia_id":"65000000-0000-4000-8000-000000000002"}','95000000-0000-4000-8000-000000000001');
update incremental_ctx set p=public.operar_catalogo('publicar',(p->>'id')::uuid,'{}','95000000-0000-4000-8000-000000000001');
reset role;
do $$begin
 perform pg_temp.assert_incremental((select ordem=0 and principal from public.midias where id='65000000-0000-4000-8000-000000000002'),'ordem e capa escolhidas');
 perform pg_temp.assert_incremental((select ativo and not dado_teste from public.produtos where codigo='RM-MANUAL-CI'),'manual real publicado');
 raise notice 'PASS: incremental 1 painel cria código próprio, variação, fotos, ordem, capa e publicação';
end$$;
set local role authenticated;
do $$begin
 begin perform public.operar_catalogo('midia_ordenar','45000000-0000-4000-8000-000000000001','{"ids":["65000000-0000-4000-8000-000000000001","65000000-0000-4000-8000-000000000001"]}','95000000-0000-4000-8000-000000000001');raise exception 'FAIL ordem duplicada';exception when invalid_parameter_value then null;end;
 begin perform public.operar_catalogo('salvar','45000000-0000-4000-8000-000000000001','{"nome":"Peça real manual","categoria_id":"25000000-0000-4000-8000-000000000001","preco":100,"variacoes":[{"id":"55000000-0000-4000-8000-000000000001","cor":"Azul","tamanho":"P","quantidade":1.5}],"motivo_estoque":"CI"}','95000000-0000-4000-8000-000000000001');raise exception 'FAIL estoque fracionado';exception when invalid_parameter_value then null;end;
end$$;
reset role;
do $$begin raise notice 'PASS: incremental 2 painel rejeita ordem inválida e quantidade fracionada sem escrita parcial';end$$;
-- Corte simulado somente na transação local. A peça real permanece disponível e alterável.
create or replace function private.teste_visivel() returns boolean language sql stable set search_path='' as $$select false$$;
set local role authenticated;
update incremental_ctx set p=public.operar_catalogo('salvar',(p->>'id')::uuid,'{"nome":"Peça real manual","categoria_id":"25000000-0000-4000-8000-000000000001","preco":100,"variacoes":[{"id":"55000000-0000-4000-8000-000000000001","cor":"Azul","tamanho":"P","quantidade":0}],"motivo_estoque":"Venda WhatsApp CI"}','95000000-0000-4000-8000-000000000001');
update incremental_ctx set p=public.operar_catalogo('rascunho',(p->>'id')::uuid,'{}','95000000-0000-4000-8000-000000000001');
update incremental_ctx set p=public.operar_catalogo('publicar',(p->>'id')::uuid,'{}','95000000-0000-4000-8000-000000000001');
reset role;
set local role anon;
do $$begin perform pg_temp.assert_incremental((select disponivel=0 from public.v_estoque_disponivel where variacao_id='55000000-0000-4000-8000-000000000001'),'esgotado após baixa manual');end$$;
reset role;
do $$begin raise notice 'PASS: incremental 3 após corte permite baixa, edição, despublicar e republicar peça real esgotada';end$$;
insert into storage.objects(bucket_id,name) values('produtos-publico','lancamento/95000000-0000-4000-8000-000000000002/RM-TRIPLA/01.webp');
update incremental_ctx set lote='95000000-0000-4000-8000-000000000002',manifesto=jsonb_build_array(jsonb_build_object('codigo','RM-TRIPLA','nome','Peça tripla','categoria','Vestidos incremental','preco',110,'publicar','sim','assinatura_carga',repeat('a',64),'variacoes',jsonb_build_array(jsonb_build_object('cor','Azul','tamanho','P','estoque',1),jsonb_build_object('cor','Azul','tamanho','M','estoque',2),jsonb_build_object('cor','Preto','tamanho','GG','estoque',3)),'fotos',jsonb_build_array(jsonb_build_object('caminho','lancamento/95000000-0000-4000-8000-000000000002/RM-TRIPLA/01.webp','ordem',1))));
set local role authenticated;
select public.aplicar_carga_oficial(lote,manifesto,public.contexto_carga_oficial()->>'assinatura','backup-ci-incremental') from incremental_ctx;
reset role;
do $$begin
 perform pg_temp.assert_incremental((select count(*)=3 from public.variacoes v join public.produtos p on p.id=v.produto_id where p.codigo='RM-TRIPLA' and v.ativo),'três variações');
 perform pg_temp.assert_incremental((select ativo and arquivado_em is null from public.produtos where codigo='RM-MANUAL-CI'),'manual ausente preservado');
 raise notice 'PASS: incremental 4 carga após corte publica três variações e preserva peça manual ausente';
end$$;
-- Criar SMOKE e testar publicar é seguro: não tem visibilidade pública em nenhuma hipótese.
set local role authenticated;
select public.operar_catalogo('criar','45000000-0000-4000-8000-000000000009','{"codigo":"SMOKE-01"}','95000000-0000-4000-8000-000000000001');
reset role;
update public.produtos set nome='SMOKE CI',categoria_id='25000000-0000-4000-8000-000000000001',preco=10,ativo=true,status_catalogo='publicado' where codigo='SMOKE-01';
set local role anon;
do $$begin perform pg_temp.assert_incremental((select count(id)=0 from public.produtos where codigo='SMOKE-01'),'SMOKE jamais público');end$$;
reset role;
do $$begin raise notice 'PASS: incremental 5 SMOKE-01 é marcado teste no servidor e nunca público';end$$;
-- Novo UUID de lote, conteúdo idêntico: não muda a variação baixada pelo painel.
set local role authenticated;
select public.operar_catalogo('salvar',(select id from public.produtos where codigo='RM-TRIPLA'),jsonb_build_object('nome','Peça tripla','categoria_id','25000000-0000-4000-8000-000000000001','preco',110,'motivo_estoque','Venda CI','variacoes',jsonb_build_array(jsonb_build_object('id',(select id from public.variacoes where produto_id=(select id from public.produtos where codigo='RM-TRIPLA') and cor='Azul' and tamanho='P'),'cor','Azul','tamanho','P','quantidade',0))),'95000000-0000-4000-8000-000000000003');
reset role;
insert into storage.objects(bucket_id,name) values('produtos-publico','lancamento/95000000-0000-4000-8000-000000000003/RM-TRIPLA/01.webp');
update incremental_ctx set lote='95000000-0000-4000-8000-000000000003',manifesto=jsonb_set(manifesto,'{0,fotos,0,caminho}','"lancamento/95000000-0000-4000-8000-000000000003/RM-TRIPLA/01.webp"');
set local role authenticated;
select public.aplicar_carga_oficial(lote,manifesto,public.contexto_carga_oficial()->>'assinatura','backup-ci-incremental') from incremental_ctx;
reset role;
do $$begin
 perform pg_temp.assert_incremental((select estoque_fisico=0 from public.variacoes v join public.produtos p on p.id=v.produto_id where p.codigo='RM-TRIPLA' and cor='Azul' and tamanho='P'),'repetição não repõe vendido');
 perform pg_temp.assert_incremental((select count(*)=3 from public.variacoes v join public.produtos p on p.id=v.produto_id where p.codigo='RM-TRIPLA'),'sem variações duplicadas');
 raise notice 'PASS: incremental 6 idempotência entre lotes diferentes preserva baixa manual';
end$$;
-- Reaproveita código arquivado de teste, sem inventar/publicar dados antigos.
insert into public.produtos(id,codigo,slug,dado_teste,ativo,arquivado_em,status_catalogo) values('45000000-0000-4000-8000-000000000008','RM-RECUPERAR','rm-recuperar',true,false,now(),'rascunho');
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.operar_catalogo('criar',gen_random_uuid(),'{"codigo":"RM-RECUPERAR","preparar_real":true}','95000000-0000-4000-8000-000000000001');
 perform pg_temp.assert_incremental(r->>'id'='45000000-0000-4000-8000-000000000008' and (r->>'dado_teste')::boolean=false and (r->>'ativo')::boolean=false and r->>'nome' is null,'recuperação segura de rascunho real');
end$$;
reset role;
do $$begin raise notice 'PASS: incremental 7 após corte prepara rascunho real com mesmo código e UUID arquivado';end$$;
rollback;
