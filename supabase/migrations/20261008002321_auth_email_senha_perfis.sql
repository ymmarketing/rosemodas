-- Construção: autenticação por senha e autorização em dados controlados pelo banco.
-- Não altera senhas, usuários Auth, dados de catálogo nem configurações do GoTrue.
begin;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'cliente' check (role in ('admin','cliente')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated,service_role;
grant select(user_id,role,ativo) on public.profiles to authenticated;
grant select,insert,update on public.profiles to service_role;
create policy perfil_proprio on public.profiles for select to authenticated
  using(user_id=(select auth.uid()));
create trigger atualizar_timestamp before update on public.profiles for each row execute function private.atualizar_timestamp();
create trigger impedir_exclusao before delete on public.profiles for each row execute function private.bloquear_exclusao();
create trigger impedir_truncate before truncate on public.profiles for each statement execute function private.bloquear_exclusao();
create function private.auditar_perfil() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.audit_log(entidade,registro_id,acao,dados_antes,dados_depois,usuario_id,origem)
  values('profiles',new.user_id,case when tg_op='INSERT' then 'create' else 'update' end,
    case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new),auth.uid(),'banco');
  return new;
end $$;
create trigger registrar_auditoria after insert or update on public.profiles for each row execute function private.auditar_perfil();
revoke all on function private.auditar_perfil() from public,anon,authenticated,service_role;

-- Preserva a admin existente; nunca lê user_metadata para atribuir permissão.
insert into public.profiles(user_id,role,ativo)
select a.id,case when u.papel='admin' and u.ativo and u.arquivado_em is null then 'admin' else 'cliente' end,true
from auth.users a left join public.usuarios_internos u on u.user_id=a.id;

create function private.criar_perfil_auth() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(user_id,role) values(new.id,'cliente');
  return new;
end $$;
create trigger criar_perfil after insert on auth.users for each row execute function private.criar_perfil_auth();

-- A tabela da equipe da V2 continua sendo o caminho manual para habilitar admins.
create function private.sincronizar_papel_equipe() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(user_id,role)
  values(new.user_id,case when new.papel='admin' and new.ativo and new.arquivado_em is null then 'admin' else 'cliente' end)
  on conflict(user_id) do update set role=excluded.role;
  return new;
end $$;
create trigger sincronizar_perfil after insert or update of papel,ativo,arquivado_em on public.usuarios_internos
  for each row execute function private.sincronizar_papel_equipe();

create function private.e_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
    and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and p.ativo)
    and exists(select 1 from jsonb_array_elements(
      case when jsonb_typeof(auth.jwt()->'amr')='array' then auth.jwt()->'amr' else '[]'::jsonb end
    ) m where m->>'method'='password');
$$;
create or replace function private.pode_gerir_catalogo() returns boolean
language sql stable security definer set search_path='' as $$ select private.e_admin(); $$;

create function public.meu_acesso() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('role',p.role,'ativo',p.ativo,'admin_autorizado',private.e_admin())
  from public.profiles p where p.user_id=auth.uid();
$$;
revoke all on function private.criar_perfil_auth(),private.sincronizar_papel_equipe(),private.e_admin(),private.pode_gerir_catalogo(),public.meu_acesso()
  from public,anon,authenticated,service_role;
grant execute on function private.e_admin(),private.pode_gerir_catalogo(),public.meu_acesso() to authenticated;
commit;
