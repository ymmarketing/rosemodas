-- Ajuste durante a homologação: Yasmin escolheu e-mail OU SMS, sem senha/TOTP.
-- A equipe continua autorizada por tabela; sessão por senha não substitui o código.
begin;
alter table public.usuarios_internos drop constraint usuarios_internos_mfa_exigido_check;
create or replace function private.pode_gerir_catalogo() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and exists(select 1 from public.usuarios_internos u where u.user_id=auth.uid()
      and u.ativo and u.arquivado_em is null and u.papel in ('admin','estoque')
      and case when u.mfa_exigido then coalesce(auth.jwt()->>'aal','')='aal2'
        else exists(select 1 from jsonb_array_elements(
          case when jsonb_typeof(auth.jwt()->'amr')='array' then auth.jwt()->'amr' else '[]'::jsonb end
        ) m where m->>'method' in ('otp','magiclink','invite')) end);
$$;
-- Apenas o texto de erro muda na RPC existente. Mantém corpo e permissões.
do $$ declare definicao text; anterior text := 'Acesso interno autorizado e MFA são obrigatórios.';
begin
  definicao := pg_get_functiondef('private.operar_catalogo(text,uuid,jsonb,uuid)'::regprocedure);
  if position(anterior in definicao)=0 then raise exception 'RPC do catálogo diferente da baseline esperada'; end if;
  execute replace(definicao,anterior,'Sessão de acesso e equipe autorizada são obrigatórias.');
end $$;
revoke all on function private.pode_gerir_catalogo() from public,anon,service_role;
grant execute on function private.pode_gerir_catalogo() to authenticated;
commit;
