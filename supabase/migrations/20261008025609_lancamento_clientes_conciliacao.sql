-- Cadastro e vínculo manual de compras. E-mail não confirmado nunca comprova titularidade.
begin;
alter table public.clientes add column privacidade_aceita_em timestamptz;
alter table public.clientes add column privacidade_versao text;
create table private.conciliacoes_clientes(
 id uuid primary key default gen_random_uuid(),cliente_anterior_id uuid not null references public.clientes(id) on delete restrict,
 cliente_novo_id uuid not null references public.clientes(id) on delete restrict,email_informado text not null,
 criado_em timestamptz not null default now(),resolvido_em timestamptz,resolvido_por uuid references auth.users(id) on delete restrict,
 confirmacao_whatsapp text,unique(cliente_anterior_id,cliente_novo_id),check(cliente_anterior_id<>cliente_novo_id)
);
alter table private.conciliacoes_clientes enable row level security;
revoke all on private.conciliacoes_clientes from public,anon,authenticated,service_role;
create trigger impedir_exclusao before delete on private.conciliacoes_clientes for each row execute function private.bloquear_exclusao();
create trigger impedir_truncate before truncate on private.conciliacoes_clientes for each statement execute function private.bloquear_exclusao();
create trigger registrar_auditoria after insert or update on private.conciliacoes_clientes for each row execute function private.registrar_auditoria();
create or replace function private.criar_cliente_auth() returns trigger language plpgsql security definer set search_path='' as $$
declare anterior uuid;novo uuid;email_c text:=lower(btrim(new.email));nome_c text;wa text;teste boolean;
begin
 if exists(select 1 from public.usuarios_internos where user_id=new.id and papel='admin' and ativo and arquivado_em is null) then return new;end if;
 nome_c:=coalesce(nullif(btrim(new.raw_user_meta_data->>'nome'),''),'Cliente');
 wa:=new.raw_user_meta_data->>'whatsapp';if wa is not null and wa !~ '^\+55[0-9]{10,11}$' then wa:=null;end if;
 teste:=email_c like 'teste+%';
 select id into anterior from public.clientes where email_normalizado=email_c and mesclado_em_cliente_id is null for update;
 begin
  insert into public.clientes(auth_user_id,email_normalizado,nome,whatsapp_normalizado,dado_teste,privacidade_aceita_em,privacidade_versao)
  values(new.id,case when anterior is null then email_c else null end,nome_c,wa,teste,
   case when new.raw_user_meta_data->>'aceite_privacidade'='true' then now() end,
   case when new.raw_user_meta_data->>'aceite_privacidade'='true' then '2026-10-08' end) returning id into novo;
 exception when unique_violation then
  select id into anterior from public.clientes where email_normalizado=email_c and mesclado_em_cliente_id is null for update;
  if anterior is null then raise;end if;
  insert into public.clientes(auth_user_id,nome,whatsapp_normalizado,dado_teste,privacidade_aceita_em,privacidade_versao)
  values(new.id,nome_c,wa,teste,case when new.raw_user_meta_data->>'aceite_privacidade'='true' then now() end,
    case when new.raw_user_meta_data->>'aceite_privacidade'='true' then '2026-10-08' end) returning id into novo;
 end;
 if anterior is not null then insert into private.conciliacoes_clientes(cliente_anterior_id,cliente_novo_id,email_informado) values(anterior,novo,email_c);end if;
 update public.profiles set dado_teste=teste where user_id=new.id;
 return new;
end $$;
create or replace function private.sincronizar_papel_equipe() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(user_id,role) values(new.user_id,case when new.papel='admin' and new.ativo and new.arquivado_em is null then 'admin' else 'cliente' end)
 on conflict(user_id) do update set role=excluded.role;
 if new.papel='admin' and new.ativo and new.arquivado_em is null then
  update public.clientes set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where auth_user_id=new.user_id and ativo;
 end if;
 return new;
end $$;
update public.clientes c set ativo=false,arquivado_em=coalesce(c.arquivado_em,now()) from public.usuarios_internos u
 where u.user_id=c.auth_user_id and u.papel='admin' and u.ativo and u.arquivado_em is null and c.ativo;
create function public.conciliacoes_clientes(p_id uuid default null,p_confirmacao_whatsapp text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q private.conciliacoes_clientes;ant public.clientes;nov public.clientes;
begin
 if not private.e_admin() then raise exception 'Somente admin por senha.' using errcode='42501';end if;
 if p_id is null then return coalesce((select jsonb_agg(to_jsonb(x)) from(
  select fila.id,fila.email_informado,fila.criado_em,ca.nome as nome_anterior,cn.nome as nome_novo,
   ca.whatsapp_normalizado as whatsapp_anterior,cn.whatsapp_normalizado as whatsapp_novo,
   (select count(*) from public.pedidos p where p.cliente_id=ca.id and p.arquivado_em is null) as compras_anteriores
  from private.conciliacoes_clientes fila join public.clientes ca on ca.id=fila.cliente_anterior_id join public.clientes cn on cn.id=fila.cliente_novo_id
  where fila.resolvido_em is null and cn.ativo and cn.arquivado_em is null order by fila.criado_em) x),'[]');end if;
 if length(btrim(coalesce(p_confirmacao_whatsapp,'')))<10 then raise exception 'Registre como confirmou a titularidade com a cliente pelo WhatsApp.' using errcode='22023';end if;
 select * into q from private.conciliacoes_clientes where id=p_id for update;if not found or q.resolvido_em is not null then raise exception 'Conciliação não está pendente.' using errcode='22023';end if;
 select * into ant from public.clientes where id=q.cliente_anterior_id for update;
 select * into nov from public.clientes where id=q.cliente_novo_id for update;
 if ant.auth_user_id is not null or ant.mesclado_em_cliente_id is not null or nov.auth_user_id is null or not nov.ativo
  or exists(select 1 from public.profiles where user_id=nov.auth_user_id and(role<>'cliente' or not ativo)) then raise exception 'Não é seguro vincular estas contas. Revise o cadastro.' using errcode='22023';end if;
 perform set_config('app.correlation_id',p_id::text,true);
 update public.pedidos set cliente_id=nov.id where cliente_id=ant.id;
 update public.enderecos set principal=false where cliente_id=ant.id and principal;
 update public.enderecos set cliente_id=nov.id where cliente_id=ant.id;
 update public.clientes set ativo=false,arquivado_em=now(),mesclado_em_cliente_id=nov.id,mesclado_em=now() where id=ant.id;
 update public.clientes set email_normalizado=q.email_informado,whatsapp_normalizado=coalesce(whatsapp_normalizado,ant.whatsapp_normalizado) where id=nov.id;
 update private.conciliacoes_clientes set resolvido_em=now(),resolvido_por=auth.uid(),confirmacao_whatsapp=p_confirmacao_whatsapp where id=p_id;
 return jsonb_build_object('vinculado',true);
end $$;
revoke all on function public.conciliacoes_clientes(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.conciliacoes_clientes(uuid,text) to authenticated;
-- Permissões restritas de servidor solicitadas em P1.3; DELETE continua proibido por grant e trigger.
grant select,insert,update on public.clientes,public.enderecos,public.pedidos,public.itens_pedido,public.enderecos_pedido,public.envios to service_role;
grant select,insert on public.eventos_envio to service_role;
commit;
