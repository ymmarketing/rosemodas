-- Critérios de autorização atuais. Dados fictícios descartados pela transação.
begin;
create function pg_temp.checar(ok boolean,msg text) returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %',msg;end if;
end $$;
create function pg_temp.negado(sql text,codigo text default '42501') returns void language plpgsql as $$ begin
  begin execute sql;exception when others then if sqlstate=codigo then return;end if;raise;end;
  raise exception 'FAIL: operação proibida executou: %',sql;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('13000000-0000-4000-8000-000000000001','admin-senha@example.test','{}'),
 ('13000000-0000-4000-8000-000000000002','cliente-a@example.test','{"role":"admin","papel":"admin"}'),
 ('13000000-0000-4000-8000-000000000003','cliente-b@example.test','{}');
insert into public.usuarios_internos(user_id,nome,email,papel) values
 ('13000000-0000-4000-8000-000000000001','Admin fictícia','admin-senha@example.test','admin');
do $$ begin
  perform pg_temp.checar((select role='cliente' from public.profiles where user_id='13000000-0000-4000-8000-000000000002'),'user_metadata não promove cliente');
  perform pg_temp.checar((select role='admin' from public.profiles where user_id='13000000-0000-4000-8000-000000000001'),'cadastro manual da equipe promove admin');
  perform pg_temp.checar((select count(*)=3 from public.clientes where auth_user_id in ('13000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000003')),'cadastros ligados a auth.users');
  raise notice 'PASS: 21 perfil cliente automático; admin só por dado protegido do banco';
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
do $$ begin
  perform pg_temp.checar((public.meu_acesso()->>'admin_autorizado')::boolean,'admin com senha entra sem OTP/MFA');
  perform pg_temp.checar(public.operar_catalogo('listar')?'itens','RPC permite senha');
end $$;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated","amr":[{"method":"otp"}]}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$);end $$;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000002","role":"authenticated","amr":[{"method":"password"}],"user_metadata":{"role":"admin"}}',true);
do $$ begin
  perform pg_temp.checar(not (public.meu_acesso()->>'admin_autorizado')::boolean,'cliente bloqueada');
  perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$);
  perform pg_temp.negado($q$update public.profiles set role='admin'$q$);
  perform pg_temp.negado($q$insert into public.usuarios_internos(user_id,nome,email,papel) values('13000000-0000-4000-8000-000000000002','Fake','fake@example.test','admin')$q$);
end $$;
reset role;
do $$ begin raise notice 'PASS: 22 senha substitui OTP; cliente não acessa RPC nem promove seu papel';end $$;

insert into public.categorias(id,nome,slug) values('23000000-0000-4000-8000-000000000001','Categoria fictícia senha','categoria-ficticia-senha');
insert into public.produtos(id,codigo,nome,slug,categoria_id,preco,ativo) values('43000000-0000-4000-8000-000000000001','TESTE-SENHA','Peça fictícia senha','peca-ficticia-senha','23000000-0000-4000-8000-000000000001',10,false);
insert into public.variacoes(id,produto_id,sku,tamanho,cor) values('53000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','TESTE-SENHA-48','48','Fictícia');
insert into public.pedidos(id,numero,cliente_id,canal,subtotal,total)
select '73000000-0000-4000-8000-000000000001','TESTE-A',id,'whatsapp',10,10 from public.clientes where auth_user_id='13000000-0000-4000-8000-000000000002';
insert into public.pedidos(id,numero,cliente_id,canal,subtotal,total)
select '73000000-0000-4000-8000-000000000002','TESTE-B',id,'whatsapp',10,10 from public.clientes where auth_user_id='13000000-0000-4000-8000-000000000003';
insert into public.itens_pedido(pedido_id,produto_id,variacao_id,sku_snapshot,nome_snapshot,cor_snapshot,tamanho_snapshot,preco_unitario,quantidade,total_item)
select id,'43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','TESTE-SENHA-48','Peça fictícia','Fictícia','48',10,1,10 from public.pedidos where numero in ('TESTE-A','TESTE-B');
insert into public.enderecos_pedido(pedido_id,nome_destinatario,cep,rua,numero,bairro,cidade,uf)
select id,'Cliente fictícia','00000000','Rua fictícia','0','Bairro fictício','Cidade fictícia','MG' from public.pedidos where numero in ('TESTE-A','TESTE-B');
insert into public.envios(id,pedido_id,tipo,servico,codigo_rastreio) values
 ('83000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','saida','pac','TESTE-A'),
 ('83000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002','saida','pac','TESTE-B');
insert into public.eventos_envio(envio_id,codigo,descricao,data_evento) select id,'TESTE','Evento fictício',now() from public.envios where codigo_rastreio in ('TESTE-A','TESTE-B');
insert into public.enderecos(cliente_id,nome_destinatario,cep,rua,numero,bairro,cidade,uf)
select cliente_id,'Cliente fictícia','00000000','Rua fictícia','0','Bairro fictício','Cidade fictícia','MG' from public.pedidos where numero in ('TESTE-A','TESTE-B');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000002","role":"authenticated","amr":[{"method":"password"}]}',true);
do $$ begin
  perform pg_temp.checar((select count(id)=1 from public.pedidos),'A vê um pedido');
  perform pg_temp.checar((select numero='TESTE-A' from public.pedidos),'A vê somente A');
  perform pg_temp.checar((select count(id)=0 from public.pedidos where id='73000000-0000-4000-8000-000000000002'),'ID direto de B oculto');
  perform pg_temp.checar((select count(id)=1 from public.itens_pedido),'itens isolados');
  perform pg_temp.checar((select count(pedido_id)=1 from public.enderecos_pedido),'endereço do pedido isolado');
  perform pg_temp.checar((select count(id)=1 from public.enderecos),'endereço salvo isolado');
  perform pg_temp.checar((select count(id)=1 from public.envios),'envios isolados');
  perform pg_temp.checar((select count(id)=1 from public.eventos_envio),'eventos isolados');
  perform pg_temp.negado($q$select custo_unitario_snapshot from public.itens_pedido$q$);
  perform pg_temp.negado($q$select observacoes from public.pedidos$q$);
  perform pg_temp.negado($q$select valor_pago_correios from public.envios$q$);
  perform pg_temp.negado($q$update public.pedidos set cliente_id=private.cliente_atual_id()$q$);
end $$;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000003","role":"authenticated","amr":[{"method":"password"}]}',true);
do $$ begin perform pg_temp.checar((select numero='TESTE-B' from public.pedidos),'B vê somente B');end $$;
reset role;
do $$ begin raise notice 'PASS: 23 A/B isoladas por auth.uid em compras, itens, endereços e rastreios; campos internos protegidos';end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated","amr":[{"method":"password"}]}',true);
do $$ begin
  perform pg_temp.checar((select count(id)=2 from public.pedidos),'admin vê todos os pedidos');
  perform pg_temp.checar((select count(id)=2 from public.itens_pedido),'admin vê todos os itens');
end $$;
reset role;
update public.profiles set ativo=false where user_id='13000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  perform pg_temp.checar((select count(id)=0 from public.pedidos),'revogação vale para sessão existente');
  perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$);
end $$;
reset role;
set local role anon;
do $$ begin
  perform pg_temp.negado($q$select id from public.pedidos$q$);
  perform pg_temp.negado($q$select public.meu_acesso()$q$);
end $$;
reset role;
do $$ begin raise notice 'PASS: 24 admin lê todos; revogação imediata; público sem acesso às compras';end $$;
do $$ begin
  perform pg_temp.negado($q$update public.eventos_envio set descricao='Alterado'$q$);
  perform pg_temp.negado($q$delete from public.eventos_envio$q$);
  perform pg_temp.negado($q$truncate public.eventos_envio$q$);
  perform pg_temp.checar(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),'todas as tabelas com RLS');
  perform pg_temp.checar(not exists(select 1 from pg_constraint where connamespace='public'::regnamespace and not convalidated),'constraints validadas');
  perform pg_temp.checar(not exists(select 1 from pg_tables where schemaname='public' and tablename in ('pagamentos','reembolsos','carrinhos','fornecedores','lives','campanhas')),'checkout, integrações e ERP não antecipados');
  raise notice 'PASS: 25 append-only, constraints, RLS e escopo de consulta preservados';
end $$;
rollback;
