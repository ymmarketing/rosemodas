-- Ajuste solicitado durante homologação. Fixtures descartados por rollback.
begin;
create function pg_temp.checar(ok boolean,msg text) returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %',msg; end if;
end $$;
create function pg_temp.negado(comando text) returns void language plpgsql as $$ begin
  begin execute comando; exception when insufficient_privilege then return; end;
  raise exception 'FAIL: operação proibida executou: %',comando;
end $$;
insert into auth.users(id) values('12000000-0000-0000-0000-000000000001'),('12000000-0000-0000-0000-000000000002');
insert into public.usuarios_internos(user_id,nome,email,papel,mfa_exigido) values
 ('12000000-0000-0000-0000-000000000001','Código fictício','codigo@example.test','admin',false);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","aal":"aal1","amr":[{"method":"password"}],"role":"authenticated"}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$); end $$;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","aal":"aal1","amr":[{"method":"token_refresh"}],"role":"authenticated"}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$); end $$;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","aal":"aal1","amr":{"method":"otp"},"role":"authenticated"}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$); end $$;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","aal":"aal1","amr":[{"method":"magiclink"}],"role":"authenticated"}',true);
do $$ begin perform pg_temp.checar(public.operar_catalogo('listar')?'itens','link da conta autorizada entra sem senha/TOTP'); end $$;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","aal":"aal1","amr":[{"method":"invite"}],"role":"authenticated"}',true);
do $$ begin perform pg_temp.checar(public.operar_catalogo('listar')?'itens','convite é aceito para conta autorizada'); end $$;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","aal":"aal1","amr":[{"method":"otp"}],"role":"authenticated"}',true);
select public.operar_catalogo('criar','45000000-0000-0000-0000-000000000001');
insert into storage.objects(bucket_id,name) values('produtos-publico','45000000-0000-0000-0000-000000000001/67000000-0000-0000-0000-000000000001.webp');
do $$ begin perform pg_temp.negado($q$update public.usuarios_internos set mfa_exigido=false$q$); end $$;
reset role;
do $$ begin raise notice 'PASS: 18 código/link substituem senha sem liberar alteração da própria autorização'; end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000002","aal":"aal1","amr":[{"method":"otp"}],"role":"authenticated","user_metadata":{"papel":"admin","mfa_exigido":false}}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$); end $$;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","aal":"aal1","amr":[{"method":"otp"}],"is_anonymous":true,"role":"authenticated"}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$); end $$;
reset role;
update public.usuarios_internos set ativo=false where user_id='12000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","aal":"aal1","amr":[{"method":"otp"}],"role":"authenticated"}',true);
do $$ begin perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$); end $$;
reset role;
set local role anon;
do $$ begin
  perform pg_temp.checar((select count(id)=0 from public.produtos where id='45000000-0000-0000-0000-000000000001'),'rascunho continua oculto');
  perform pg_temp.negado($q$select public.operar_catalogo('listar')$q$);
end $$;
reset role;
do $$ begin raise notice 'PASS: 19 OTP não concede papel, não ignora revogação e não publica rascunhos'; end $$;
rollback;
