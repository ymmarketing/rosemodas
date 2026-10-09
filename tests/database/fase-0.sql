-- Todos os dados e helpers desta suíte são descartados por ROLLBACK.
begin;

create function pg_temp.deve_ser(condicao boolean, mensagem text) returns void
language plpgsql as $$
begin
  if condicao is distinct from true then raise exception 'FAIL: %', mensagem; end if;
end $$;
create function pg_temp.deve_falhar(comando text, codigo text) returns void
language plpgsql as $$
begin
  begin
    execute comando;
  exception when others then
    if sqlstate = codigo then return; end if;
    raise exception 'FAIL: esperado SQLSTATE %, recebido %: %', codigo, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: comando proibido executado: %', comando;
end $$;

do $$ declare tabelas text[]; begin
  select array_agg(tablename::text order by tablename) into tabelas from pg_tables where schemaname='public' and tablename<>'usuarios_internos';
  perform pg_temp.deve_ser(tabelas = array['audit_log','categorias','colecoes','configuracoes','medidas_tamanho','midias','movimentos_estoque','produtos','variacoes'], 'exatamente nove tabelas');
  perform pg_temp.deve_ser((select count(*) = 9 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname<>'usuarios_internos' and c.relrowsecurity), 'RLS habilitada nas nove tabelas da fundação');
  perform pg_temp.deve_ser((select count(*) = 9 from pg_constraint where connamespace='public'::regnamespace and contype='p' and conrelid<>'public.usuarios_internos'::regclass), 'PK nas nove tabelas da fundação');
  perform pg_temp.deve_ser(not exists(select 1 from pg_constraint c join pg_class r on r.oid=c.confrelid join pg_namespace n on n.oid=r.relnamespace where c.connamespace='public'::regnamespace and c.contype='f' and (not c.convalidated or not (n.nspname='auth' and r.relname='users' or n.nspname='public' and r.relname = any(tabelas)))), 'FKs válidas, somente catálogo ou Auth');
  perform pg_temp.deve_ser(not exists(select 1 from information_schema.columns where table_schema='public' and column_name in ('pedido_id','reserva_id','troca_id','entrada_id','fornecedor_id','live_id','campanha_id')), 'nenhuma coluna de FK futura');
  perform pg_temp.deve_ser(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='movimentos_estoque' and column_name='usuario_id'), 'usuário interno do movimento não antecipado');
  perform pg_temp.deve_ser((select count(*) = 1 from storage.buckets where id='produtos-publico' and public), 'bucket público da fase criado');
  raise notice 'PASS: 01 migration limpa: nove tabelas, PKs, RLS, bucket e FKs da fase';
end $$;

insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001');
insert into public.categorias(id,nome,slug,ativo) values
 ('20000000-0000-0000-0000-000000000001','Vestidos','vestidos',true),
 ('20000000-0000-0000-0000-000000000002','Oculta','oculta',false);
insert into public.colecoes(id,nome,slug,atual,ativo) values
 ('30000000-0000-0000-0000-000000000001','Atual','atual',true,true),
 ('30000000-0000-0000-0000-000000000002','Oculta','oculta',false,false);
insert into public.produtos(id,codigo,nome,slug,categoria_id,colecao_id,preco,ativo,arquivado_em) values
 ('40000000-0000-0000-0000-000000000001','RM001','Peça pública','peca-publica','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',100,true,null),
 ('40000000-0000-0000-0000-000000000002','RM002','Inativa','inativa','20000000-0000-0000-0000-000000000001',null,100,false,null),
 ('40000000-0000-0000-0000-000000000003','RM003','Categoria oculta','categoria-oculta','20000000-0000-0000-0000-000000000002',null,100,true,null),
 ('40000000-0000-0000-0000-000000000004','RM004','Coleção oculta','colecao-oculta','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',100,true,null),
 ('40000000-0000-0000-0000-000000000005','RM005','Arquivada','arquivada','20000000-0000-0000-0000-000000000001',null,100,false,now());
insert into public.variacoes(id,produto_id,sku,tamanho,cor,ativo) values
 ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','RM001-PTO-48','48','Preto',true),
 ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','RM002-PTO-48','48','Preto',true),
 ('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','RM001-PTO-50','50','Preto',false),
 ('50000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000003','RM003-PTO-48','48','Preto',true),
 ('50000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000004','RM004-PTO-48','48','Preto',true);
insert into public.medidas_tamanho(produto_id,tamanho,medida,rotulo,valor_cm,ativo) values
 ('40000000-0000-0000-0000-000000000001','48','busto','Busto',116,true),
 ('40000000-0000-0000-0000-000000000002','48','busto','Busto',116,true),
 ('40000000-0000-0000-0000-000000000001','50','busto','Busto',120,false);
insert into public.midias(produto_id,variacao_id,caminho_storage,tipo,alt_texto,principal,ativo) values
 ('40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','rm001/foto.webp','foto','Peça preta',true,true),
 ('40000000-0000-0000-0000-000000000002',null,'rm002/foto.webp','foto','Peça oculta',true,true),
 ('40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003','rm001/oculta.webp','foto','Cor oculta',false,true),
 ('40000000-0000-0000-0000-000000000001',null,'rm001/inativa.webp','foto','Mídia inativa',false,false);
insert into public.configuracoes(chave,valor) values ('nome_loja','"Rose Menezes"'), ('parametro_interno','"não publicar"');

do $$ begin
  perform pg_temp.deve_falhar($q$insert into public.categorias(nome,slug) values ('Outra','vestidos')$q$, '23505');
  perform pg_temp.deve_falhar($q$insert into public.colecoes(nome,slug,atual) values ('Outra','outra',true)$q$, '23505');
  perform pg_temp.deve_falhar($q$insert into public.colecoes(nome,slug,inicio,fim) values ('Datas','datas','2026-10-02','2026-10-01')$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.produtos set preco=0 where codigo='RM001'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.produtos set preco='NaN' where codigo='RM001'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.produtos set preco_promocional=100 where codigo='RM001'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.produtos set preco_promocional=-1 where codigo='RM001'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.produtos set selo='desconhecido' where codigo='RM001'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.produtos set categoria_id='99999999-0000-0000-0000-000000000001' where codigo='RM001'$q$, '23503');
  perform pg_temp.deve_falhar($q$update public.produtos set criado_por='99999999-0000-0000-0000-000000000001' where codigo='RM001'$q$, '23503');
  perform pg_temp.deve_falhar($q$update public.medidas_tamanho set valor_cm=-1 where tamanho='48'$q$, '23514');
  perform pg_temp.deve_falhar($q$insert into public.medidas_tamanho(produto_id,tamanho,medida,rotulo,valor_cm) values ('40000000-0000-0000-0000-000000000001','48','busto','Busto',100)$q$, '23505');
  perform pg_temp.deve_falhar($q$insert into public.midias(produto_id,variacao_id,caminho_storage,tipo,alt_texto) values ('40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','x.webp','foto','Foto')$q$, '23503');
  perform pg_temp.deve_falhar($q$insert into public.midias(produto_id,caminho_storage,tipo,alt_texto,principal) values ('40000000-0000-0000-0000-000000000001','outra.webp','foto','Outra',true)$q$, '23505');
  raise notice 'PASS: 02 UNIQUEs, CHECKs, valores finitos, referências e mídia por produto';
end $$;

do $$ begin
  perform pg_temp.deve_falhar($q$insert into public.variacoes(produto_id,sku,tamanho,cor) values ('40000000-0000-0000-0000-000000000001','RM001-PTO-48','52','Rosê')$q$, '23505');
  perform pg_temp.deve_falhar($q$insert into public.variacoes(produto_id,sku,tamanho,cor) values ('40000000-0000-0000-0000-000000000001','RM001-OUTRO-48','48','Preto')$q$, '23505');
  perform pg_temp.deve_falhar($q$insert into public.variacoes(produto_id,sku,tamanho,cor) values ('40000000-0000-0000-0000-000000000001','rm001-pto-52','52','Preto')$q$, '23514');
  raise notice 'PASS: 03 SKU único e combinação produto/tamanho/cor única';
end $$;

do $$ declare id_novo uuid; data_anterior timestamptz; begin
  insert into public.categorias(nome,slug,ativo,criado_por) values ('Defaults','defaults',false,'10000000-0000-0000-0000-000000000001') returning id, atualizado_em into id_novo, data_anterior;
  perform pg_temp.deve_ser(id_novo is not null, 'UUID automático');
  update public.categorias set nome='Atualizada', atualizado_em='2000-01-01' where id=id_novo;
  perform pg_temp.deve_ser((select atualizado_em >= data_anterior from public.categorias where id=id_novo), 'timestamp mantido pelo banco');
  perform pg_temp.deve_ser(exists(select 1 from public.audit_log where entidade='categorias' and registro_id=id_novo and acao='update' and dados_antes->>'nome'='Defaults' and dados_depois->>'nome'='Atualizada'), 'auditoria antes/depois');
  raise notice 'PASS: 04 UUID, timestamps, autoria Auth e auditoria automática';
end $$;

set local role service_role;
select public.ajustar_estoque('50000000-0000-0000-0000-000000000001',5,'Saldo inicial','80000000-0000-0000-0000-000000000001');
select public.ajustar_estoque('50000000-0000-0000-0000-000000000001',-2,'Inventário','80000000-0000-0000-0000-000000000002');
reset role;
do $$ declare movimentos bigint; auditorias bigint; begin
  perform pg_temp.deve_ser((select estoque_fisico=3 and estoque_reservado=0 from public.variacoes where sku='RM001-PTO-48'), 'saldo projetado de 3');
  perform pg_temp.deve_ser((select sum(quantidade)=3 from public.movimentos_estoque where variacao_id='50000000-0000-0000-0000-000000000001'), 'ledger corresponde ao saldo');
  perform pg_temp.deve_ser(exists(select 1 from public.movimentos_estoque where quantidade=-2 and quantidade_anterior=5 and quantidade_posterior=3), 'antes/depois do ajuste');
  perform pg_temp.deve_ser((select count(*)=2 from public.audit_log where correlation_id='80000000-0000-0000-0000-000000000002'), 'saldo e movimento auditados na mesma correlação');
  select count(*) into movimentos from public.movimentos_estoque;
  select count(*) into auditorias from public.audit_log;
  perform pg_temp.deve_falhar($q$select public.ajustar_estoque('50000000-0000-0000-0000-000000000001',-4,'Inválido')$q$, '23514');
  perform pg_temp.deve_ser((select count(*)=movimentos from public.movimentos_estoque) and (select count(*)=auditorias from public.audit_log) and (select estoque_fisico=3 from public.variacoes where sku='RM001-PTO-48'), 'falha reverte saldo, ledger e auditoria');
  perform pg_temp.deve_falhar($q$select public.ajustar_estoque('50000000-0000-0000-0000-000000000001',0,'Inválido')$q$, '22023');
  perform pg_temp.deve_falhar($q$select public.ajustar_estoque('50000000-0000-0000-0000-000000000001',1,'')$q$, '22023');
  perform pg_temp.deve_falhar($q$select public.ajustar_estoque('99999999-0000-0000-0000-000000000001',1,'Inexistente')$q$, '23503');
  perform pg_temp.deve_falhar($q$update public.variacoes set estoque_fisico=10 where sku='RM001-PTO-48'$q$, '42501');
  perform pg_temp.deve_falhar($q$insert into public.variacoes(produto_id,sku,tamanho,cor,estoque_fisico) values ('40000000-0000-0000-0000-000000000001','RM001-PTO-52','52','Preto',4)$q$, '42501');
  raise notice 'PASS: 05 estoque transacional, sem saldo negativo, sem edição direta e rollback atômico';
end $$;

-- Confere CHECKs mesmo sem a proteção de domínio, somente nesta transação de teste.
alter table public.variacoes disable trigger proteger_projecoes;
do $$ begin
  perform pg_temp.deve_falhar($q$update public.variacoes set estoque_fisico=-1 where sku='RM001-PTO-48'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.variacoes set estoque_reservado=-1 where sku='RM001-PTO-48'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.variacoes set estoque_reservado=4 where sku='RM001-PTO-48'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.variacoes set estoque_reservado=1 where sku='RM001-PTO-48'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.variacoes set custo_medio=-1 where sku='RM001-PTO-48'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.variacoes set custo_medio='NaN' where sku='RM001-PTO-48'$q$, '23514');
  perform pg_temp.deve_falhar($q$update public.variacoes set estoque_minimo=-1 where sku='RM001-PTO-48'$q$, '23514');
  raise notice 'PASS: 06 CHECKs de físico/reservado/custo e ausência de reservas na Fase 0';
end $$;
alter table public.variacoes enable trigger proteger_projecoes;

do $$ begin
  perform pg_temp.deve_falhar($q$update public.movimentos_estoque set motivo='Alterado'$q$, '42501');
  perform pg_temp.deve_falhar($q$delete from public.movimentos_estoque$q$, '42501');
  perform pg_temp.deve_falhar($q$truncate public.movimentos_estoque$q$, '42501');
  perform pg_temp.deve_falhar($q$update public.audit_log set motivo='Alterado'$q$, '42501');
  perform pg_temp.deve_falhar($q$delete from public.audit_log$q$, '42501');
  perform pg_temp.deve_falhar($q$truncate public.audit_log$q$, '42501');
  perform pg_temp.deve_falhar($q$delete from public.midias$q$, '42501');
  perform pg_temp.deve_falhar($q$truncate public.midias$q$, '42501');
  raise notice 'PASS: 07 append-only bloqueia UPDATE/DELETE/TRUNCATE; cadastro preserva histórico';
end $$;

set local role anon;
do $$ begin
  perform pg_temp.deve_ser((select count(id)=1 from public.categorias), 'somente categoria ativa');
  perform pg_temp.deve_ser((select count(id)=1 from public.colecoes), 'somente coleção ativa');
  perform pg_temp.deve_ser((select count(id)=1 from public.produtos), 'produto ativo em categoria/coleção visíveis');
  perform pg_temp.deve_ser((select count(id)=1 from public.variacoes), 'variação ativa de produto visível');
  perform pg_temp.deve_ser((select count(id)=1 from public.medidas_tamanho), 'medidas do catálogo público');
  perform pg_temp.deve_ser((select count(id)=1 from public.midias), 'mídias e variações visíveis');
  perform pg_temp.deve_ser((select count(chave)=1 from public.configuracoes), 'configurações públicas em lista explícita');
  perform pg_temp.deve_ser((select disponivel=3 from public.v_estoque_disponivel where sku='RM001-PTO-48'), 'view retorna disponível');
  perform pg_temp.deve_ser((select private.saldo_publico('50000000-0000-0000-0000-000000000002') is null), 'helper não revela saldo oculto');
  perform pg_temp.deve_falhar($q$select custo_medio from public.variacoes$q$, '42501');
  perform pg_temp.deve_falhar($q$select estoque_fisico from public.variacoes$q$, '42501');
  perform pg_temp.deve_falhar($q$select estoque_reservado from public.variacoes$q$, '42501');
  perform pg_temp.deve_falhar($q$select estoque_minimo from public.variacoes$q$, '42501');
  perform pg_temp.deve_falhar($q$select criado_por from public.produtos$q$, '42501');
  perform pg_temp.deve_falhar($q$select peso_g from public.produtos$q$, '42501');
  perform pg_temp.deve_falhar($q$select * from public.variacoes$q$, '42501');
  perform pg_temp.deve_falhar($q$select * from public.audit_log$q$, '42501');
  perform pg_temp.deve_falhar($q$select * from public.movimentos_estoque$q$, '42501');
  perform pg_temp.deve_falhar($q$insert into public.categorias(nome,slug) values ('Intrusa','intrusa')$q$, '42501');
  perform pg_temp.deve_falhar($q$update public.produtos set preco=1 where codigo='RM001'$q$, '42501');
  perform pg_temp.deve_falhar($q$select public.ajustar_estoque('50000000-0000-0000-0000-000000000001',1,'Intruso')$q$, '42501');
  perform pg_temp.deve_falhar($q$select private.aplicar_movimento_estoque()$q$, '42501');
  raise notice 'PASS: 08 anon lê catálogo previsto; custo, saldos internos, autoria, auditoria e escritas bloqueados';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","user_metadata":{"papel":"admin"}}',true);
do $$ begin
  perform pg_temp.deve_ser((select count(id)=1 from public.produtos), 'authenticated não lê catálogo oculto');
  perform pg_temp.deve_falhar($q$select custo_medio from public.variacoes$q$, '42501');
  perform pg_temp.deve_falhar($q$insert into public.categorias(nome,slug) values ('Intrusa','intrusa')$q$, '42501');
  perform pg_temp.deve_falhar($q$select public.ajustar_estoque('50000000-0000-0000-0000-000000000001',1,'Intruso')$q$, '42501');
  raise notice 'PASS: 09 authenticated e metadados admin falsos não concedem acesso interno';
end $$;
reset role;
set local role service_role;
do $$ begin
  perform pg_temp.deve_falhar($q$update public.variacoes set estoque_fisico=10 where sku='RM001-PTO-48'$q$, '42501');
  perform pg_temp.deve_falhar($q$update public.variacoes set custo_medio=10 where sku='RM001-PTO-48'$q$, '42501');
  perform pg_temp.deve_falhar($q$insert into public.movimentos_estoque(variacao_id,tipo,quantidade,quantidade_anterior,quantidade_posterior,motivo,origem) values ('50000000-0000-0000-0000-000000000001','entrada',1,3,4,'Direto','rotina')$q$, '42501');
  perform pg_temp.deve_falhar($q$insert into public.audit_log(entidade,acao,origem) values ('fake','create','fake')$q$, '42501');
  perform pg_temp.deve_falhar($q$delete from public.categorias$q$, '42501');
  raise notice 'PASS: 10 servidor escreve pelo domínio, sem alterar projeções ou fabricar histórico diretamente';
end $$;
reset role;

insert into storage.buckets(id,name,public) values ('fixture-nao-publico','fixture-nao-publico',false);
insert into storage.objects(bucket_id,name) values ('produtos-publico','rm001/foto.webp'), ('fixture-nao-publico','nao-publicar.pdf');
set local role anon;
do $$ declare alteradas integer; begin
  perform pg_temp.deve_ser((select count(*)=1 from storage.objects), 'Storage público só no bucket previsto');
  perform pg_temp.deve_falhar($q$insert into storage.objects(bucket_id,name) values ('produtos-publico','intrusa.webp')$q$, '42501');
  with resultado as (update storage.objects set name='intrusa.webp' returning id)
    select count(*) into alteradas from resultado;
  perform pg_temp.deve_ser(alteradas=0, 'RLS impede substituir arquivos');
  raise notice 'PASS: 11 Storage: leitura do bucket público, sem upload ou substituição por visitante';
end $$;
reset role;

do $$ begin
  perform pg_temp.deve_ser((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.v_estoque_disponivel'::regclass), 'view usa security_invoker');
  perform pg_temp.deve_ser(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and (p.proconfig is null or not p.proconfig @> array['search_path=""'])), 'search_path fixo nas funções privilegiadas');
  perform pg_temp.deve_ser(not has_function_privilege('anon','public.ajustar_estoque(uuid,integer,text,uuid)','execute') and not has_function_privilege('authenticated','private.registrar_auditoria()','execute'), 'funções internas não expostas');
  perform pg_temp.deve_ser(not exists(select 1 from pg_trigger where tgrelid='public.variacoes'::regclass and tgname='proteger_projecoes' and tgenabled='D'), 'proteção de estoque reativada');
  raise notice 'PASS: 12 segurança das funções e view, proteção ativa e ausência de domínios futuros';
end $$;
rollback;
