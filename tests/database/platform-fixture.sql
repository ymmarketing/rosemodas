-- Exclusivo do runner PGlite. Não é migration e não é aplicado ao Supabase.
-- Representa apenas as dependências de infraestrutura usadas pela migration.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets(id text primary key, name text not null, public boolean not null default false);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
