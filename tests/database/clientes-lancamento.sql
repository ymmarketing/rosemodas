begin;
create function pg_temp.assert_cliente(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL cliente: %',msg;end if;end$$;
insert into public.clientes(id,nome,email_normalizado,whatsapp_normalizado) values('35000000-0000-4000-8000-000000000001','Cliente WhatsApp anterior','duplicado@example.test','+5531990000000');
insert into auth.users(id,email,raw_user_meta_data) values('15000000-0000-4000-8000-000000000001','duplicado@example.test','{"nome":"Cliente cadastrada","whatsapp":"+5531999999999","aceite_privacidade":true,"role":"admin"}'),('15000000-0000-4000-8000-000000000002','admin-lancamento@example.test','{}');
insert into public.pedidos(id,numero,cliente_id,canal) values('75000000-0000-4000-8000-000000000001','COMPRA-ANTERIOR','35000000-0000-4000-8000-000000000001','whatsapp');
insert into public.usuarios_internos(user_id,nome,email,papel) values('15000000-0000-4000-8000-000000000002','Admin CI','admin-lancamento@example.test','admin');
do $$begin
 perform pg_temp.assert_cliente((select count(*)=1 from public.clientes where auth_user_id='15000000-0000-4000-8000-000000000001'),'cadastro duplicado concluído');
 perform pg_temp.assert_cliente((select email_normalizado is null and nome='Cliente cadastrada' and whatsapp_normalizado='+5531999999999' and privacidade_aceita_em is not null and privacidade_versao='2026-10-08' from public.clientes where auth_user_id='15000000-0000-4000-8000-000000000001'),'dados próprios e consentimento persistidos');
 perform pg_temp.assert_cliente((select count(*)=0 from public.clientes where auth_user_id='15000000-0000-4000-8000-000000000002' and ativo),'admin não tem cliente ativo');
 perform pg_temp.assert_cliente((select role='cliente' from public.profiles where user_id='15000000-0000-4000-8000-000000000001'),'metadata não muda role');
 raise notice 'PASS: clientes 1 e-mail preexistente não quebra cadastro; admin sem cliente ativo; consentimento gravado';
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","amr":[{"method":"password"}]}',true);
do $$begin
 perform pg_temp.assert_cliente((select count(id)=0 from public.pedidos where numero='COMPRA-ANTERIOR'),'e-mail igual não libera compra');
 begin perform public.conciliacoes_clientes();raise exception 'FAIL cliente leu conciliação';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$begin raise notice 'PASS: clientes 2 compras antigas e conciliação protegidas antes da confirmação';end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000002","amr":[{"method":"password"}]}',true);
do $$declare q uuid;begin
 q:=((public.conciliacoes_clientes())->0->>'id')::uuid;
 begin perform public.conciliacoes_clientes(q,'');raise exception 'FAIL vinculou sem confirmar';exception when invalid_parameter_value then null;end;
 perform public.conciliacoes_clientes(q,'Titularidade confirmada pelo WhatsApp no teste CI');
end$$;
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","amr":[{"method":"password"}]}',true);
do $$begin perform pg_temp.assert_cliente((select count(id)=1 from public.pedidos where numero='COMPRA-ANTERIOR'),'compra passa à conta somente após vínculo admin');end$$;
reset role;
do $$begin raise notice 'PASS: clientes 3 vínculo manual por admin, com confirmação e auditoria, libera somente o UUID correto';end$$;
rollback;
