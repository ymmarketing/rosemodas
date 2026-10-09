-- Construção: curadoria e cadastro interno solicitados pela Yasmin em 07/10.
-- usuarios_internos é a tabela da V2, agora com uso real no catálogo.
-- Não introduz clientes, pedidos, reservas, pagamentos ou ERP.
begin;

create table public.usuarios_internos (
  user_id uuid primary key references auth.users(id) on delete restrict,
  nome text not null check (length(btrim(nome)) > 0),
  email text not null unique check (email = lower(btrim(email)) and position('@' in email) > 1),
  papel text not null check (papel in ('admin','vendas','estoque','financeiro')),
  ativo boolean not null default true,
  mfa_exigido boolean not null default true check (mfa_exigido),
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete restrict,
  check (arquivado_em is null or not ativo)
);
create index usuarios_internos_papel_ativo_idx on public.usuarios_internos(papel,ativo);
create index usuarios_internos_criado_por_idx on public.usuarios_internos(criado_por);
create index usuarios_internos_atualizado_por_idx on public.usuarios_internos(atualizado_por);
alter table public.usuarios_internos enable row level security;
revoke all on public.usuarios_internos from public, anon, authenticated, service_role;
grant select(user_id,nome,papel,ativo,mfa_exigido) on public.usuarios_internos to authenticated;
grant select,insert,update on public.usuarios_internos to service_role;
create policy equipe_proprio_acesso on public.usuarios_internos for select to authenticated
  using (user_id = (select auth.uid()));
create trigger atualizar_timestamp before update on public.usuarios_internos for each row execute function private.atualizar_timestamp();
create trigger impedir_exclusao before delete on public.usuarios_internos for each row execute function private.bloquear_exclusao();
create trigger impedir_truncate before truncate on public.usuarios_internos for each statement execute function private.bloquear_exclusao();

-- A auditoria mantém o user_id como registro, sem modificar históricos anteriores.
create function private.auditar_equipe() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.audit_log(entidade,registro_id,acao,dados_antes,dados_depois,usuario_id,origem)
  values ('usuarios_internos',new.user_id,case when tg_op='INSERT' then 'create' else 'update' end,
    case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new),auth.uid(),'banco');
  return new;
end $$;
create trigger registrar_auditoria after insert or update on public.usuarios_internos for each row execute function private.auditar_equipe();

-- Rascunhos não exigem informações comerciais ainda desconhecidas.
alter table public.produtos alter column nome drop not null;
alter table public.produtos alter column categoria_id drop not null;
alter table public.produtos alter column preco drop not null;
alter table public.produtos add column status_catalogo text not null default 'publicado'
  check (status_catalogo in ('rascunho','publicado'));
alter table public.produtos add column nome_sugerido text;
alter table public.produtos add column observacoes_curadoria text not null default '';
alter table public.midias add column origem_arquivo_id text unique;
alter table public.midias add column arquivo_nome_original text;
alter table public.produtos add constraint produtos_rascunho_oculto check (status_catalogo <> 'rascunho' or not ativo);
alter table public.produtos add constraint produtos_publicado_completo check (
  status_catalogo <> 'publicado' or (nome is not null and categoria_id is not null and preco is not null));
create index produtos_status_catalogo_criado_idx on public.produtos(status_catalogo,criado_em desc);

create function private.pode_gerir_catalogo() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'aal','')='aal2'
    and exists(select 1 from public.usuarios_internos u where u.user_id=auth.uid()
      and u.ativo and u.arquivado_em is null and u.mfa_exigido and u.papel in ('admin','estoque'));
$$;

create function private.midia_catalogo_permitida(p_nome text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.pode_gerir_catalogo()
    and p_nome ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$'
    and exists(select 1 from public.produtos p where p.id::text=split_part(p_nome,'/',1) and p.arquivado_em is null);
$$;
create policy equipe_upload_catalogo on storage.objects for insert to authenticated
  with check (bucket_id='produtos-publico' and private.midia_catalogo_permitida(name));
-- Arquivos originais não são sobrescritos/apagados; substituir = nova mídia.

create function private.catalogo_snapshot(p_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select to_jsonb(p) || jsonb_build_object(
  'midias',coalesce((select jsonb_agg(to_jsonb(m) order by m.ordem,m.criado_em) from public.midias m where m.produto_id=p.id and m.arquivado_em is null),'[]'::jsonb),
  'variacoes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'tamanho',v.tamanho,'cor',v.cor,'quantidade',v.estoque_fisico,'ativo',v.ativo) order by v.tamanho,v.cor) from public.variacoes v where v.produto_id=p.id and v.arquivado_em is null),'[]'::jsonb),
  'medidas',coalesce((select jsonb_agg(to_jsonb(m) order by m.tamanho,m.ordem) from public.medidas_tamanho m where m.produto_id=p.id and m.arquivado_em is null),'[]'::jsonb))
 from public.produtos p where p.id=p_id;
$$;

-- Única entrada de operações do painel; a autorização é conferida no banco,
-- inclusive para sessões antigas ou metadados admin fabricados pelo usuário.
create function private.operar_catalogo(p_acao text,p_id uuid,p_dados jsonb,p_correlation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.produtos; v public.variacoes; item jsonb; uid uuid; id_midia uuid; pagina integer; resultado jsonb;
begin
  if not private.pode_gerir_catalogo() then raise exception 'Acesso interno autorizado e MFA são obrigatórios.' using errcode='42501'; end if;
  if p_correlation_id is null or jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;
  perform set_config('app.correlation_id',p_correlation_id::text,true);
  if p_acao='listar' then
    pagina := greatest(0,coalesce((p_dados->>'pagina')::integer,0));
    select jsonb_build_object('itens',coalesce(jsonb_agg(private.catalogo_snapshot(x.id)),'[]'::jsonb)) into resultado
    from (select id from public.produtos where arquivado_em is null
      and (coalesce(p_dados->>'status','')='' or status_catalogo=p_dados->>'status')
      and (coalesce(p_dados->>'busca','')='' or coalesce(nome,'')||' '||codigo ilike '%'||(p_dados->>'busca')||'%')
      order by criado_em desc,id limit 48 offset pagina*48) x;
    return resultado || jsonb_build_object(
      'total',(select count(*) from public.produtos where arquivado_em is null
        and (coalesce(p_dados->>'status','')='' or status_catalogo=p_dados->>'status')
        and (coalesce(p_dados->>'busca','')='' or coalesce(nome,'')||' '||codigo ilike '%'||(p_dados->>'busca')||'%')),
      'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by ordem,nome) from public.categorias where ativo and arquivado_em is null),'[]'::jsonb),
      'colecoes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by inicio desc nulls last) from public.colecoes where ativo and arquivado_em is null),'[]'::jsonb));
  end if;
  if p_id is null then raise exception 'Peça não informada.' using errcode='22023'; end if;
  if p_acao='criar' then
    insert into public.produtos(id,codigo,slug,nome,categoria_id,preco,status_catalogo,ativo,criado_por,atualizado_por)
    values(p_id,'RM-'||upper(substr(replace(p_id::text,'-',''),1,12)),'rm-'||replace(p_id::text,'-',''),null,null,null,'rascunho',false,auth.uid(),auth.uid())
    on conflict(id) do nothing;
    return private.catalogo_snapshot(p_id);
  end if;
  select * into p from public.produtos where id=p_id and arquivado_em is null for update;
  if not found then raise exception 'Peça não encontrada.' using errcode='P0002'; end if;
  if p_acao='abrir' then return private.catalogo_snapshot(p_id); end if;
  if p_dados ? 'atualizado_em' and p.atualizado_em is distinct from (p_dados->>'atualizado_em')::timestamptz then
    raise exception 'A peça foi alterada em outro acesso. Reabra antes de salvar.' using errcode='40001';
  end if;
  if p_acao='salvar' then
    update public.produtos set nome=nullif(btrim(p_dados->>'nome'),''), descricao=coalesce(p_dados->>'descricao',''),
      categoria_id=nullif(p_dados->>'categoria_id','')::uuid,colecao_id=nullif(p_dados->>'colecao_id','')::uuid,
      preco=nullif(p_dados->>'preco','')::numeric,preco_promocional=nullif(p_dados->>'preco_promocional','')::numeric,
      modelo_veste=nullif(p_dados->>'modelo_veste',''),atualizado_por=auth.uid() where id=p_id;
    for item in select value from jsonb_array_elements(coalesce(p_dados->'variacoes','[]'::jsonb)) loop
      uid:=coalesce(nullif(item->>'id','')::uuid,gen_random_uuid());
      select * into v from public.variacoes where id=uid for update;
      if found and v.produto_id<>p_id then raise exception 'Variação de outra peça.' using errcode='42501'; end if;
      if nullif(btrim(item->>'tamanho'),'') is null or nullif(btrim(item->>'cor'),'') is null
        or (item->>'quantidade') is null or (item->>'quantidade')::integer<0 then
        raise exception 'Informe tamanho, cor e quantidade válida da variação.' using errcode='22023'; end if;
      insert into public.variacoes(id,produto_id,sku,tamanho,cor,ativo,criado_por,atualizado_por)
      values(uid,p_id,coalesce(nullif(btrim(item->>'sku'),''),p.codigo||'-'||upper(substr(replace(uid::text,'-',''),1,8))),
        btrim(item->>'tamanho'),btrim(item->>'cor'),coalesce((item->>'ativo')::boolean,true),auth.uid(),auth.uid())
      on conflict(id) do update set sku=excluded.sku,tamanho=excluded.tamanho,cor=excluded.cor,ativo=excluded.ativo,atualizado_por=auth.uid();
      select * into v from public.variacoes where id=uid for update;
      if (item->>'quantidade')::integer<>v.estoque_fisico then
        if nullif(btrim(p_dados->>'motivo_estoque'),'') is null then raise exception 'Informe o motivo do ajuste de estoque.' using errcode='22023'; end if;
        perform public.ajustar_estoque(uid,(item->>'quantidade')::integer-v.estoque_fisico,p_dados->>'motivo_estoque',p_correlation_id);
      end if;
    end loop;
    for item in select value from jsonb_array_elements(coalesce(p_dados->'medidas','[]'::jsonb)) loop
      uid:=coalesce(nullif(item->>'id','')::uuid,gen_random_uuid());
      if exists(select 1 from public.medidas_tamanho where id=uid and produto_id<>p_id) then raise exception 'Medida de outra peça.' using errcode='42501'; end if;
      insert into public.medidas_tamanho(id,produto_id,tamanho,medida,rotulo,valor_cm,ativo,criado_por,atualizado_por)
      values(uid,p_id,btrim(item->>'tamanho'),item->>'medida',btrim(item->>'rotulo'),(item->>'valor_cm')::numeric,coalesce((item->>'ativo')::boolean,true),auth.uid(),auth.uid())
      on conflict(id) do update set tamanho=excluded.tamanho,medida=excluded.medida,rotulo=excluded.rotulo,valor_cm=excluded.valor_cm,ativo=excluded.ativo,atualizado_por=auth.uid();
    end loop;
  elsif p_acao='publicar' then
    if nullif(btrim(p.nome),'') is null or p.preco is null or p.preco<=0 or p.categoria_id is null
      or not exists(select 1 from public.categorias where id=p.categoria_id and ativo and arquivado_em is null)
      or (p.colecao_id is not null and not exists(select 1 from public.colecoes where id=p.colecao_id and ativo and arquivado_em is null))
      or not exists(select 1 from public.midias m join storage.objects o on o.bucket_id='produtos-publico' and o.name=m.caminho_storage
        where m.produto_id=p_id and m.tipo='foto' and m.principal and m.ativo and m.arquivado_em is null)
      or not exists(select 1 from public.variacoes where produto_id=p_id and ativo and arquivado_em is null) then
      raise exception 'Para publicar: nome, preço, categoria, foto de capa e variação com tamanho, cor e quantidade.' using errcode='23514';
    end if;
    update public.produtos set status_catalogo='publicado',ativo=true,atualizado_por=auth.uid() where id=p_id;
  elsif p_acao='rascunho' then
    update public.produtos set status_catalogo='rascunho',ativo=false,atualizado_por=auth.uid() where id=p_id;
  elsif p_acao='arquivar' then
    update public.produtos set ativo=false,arquivado_em=now(),atualizado_por=auth.uid() where id=p_id;
  elsif p_acao='midia_adicionar' then
    if not private.midia_catalogo_permitida(p_dados->>'caminho_storage') or split_part(p_dados->>'caminho_storage','/',1)<>p_id::text
      or not exists(select 1 from storage.objects where bucket_id='produtos-publico' and name=p_dados->>'caminho_storage') then
      raise exception 'Arquivo não enviado para esta peça.' using errcode='22023'; end if;
    id_midia:=coalesce(nullif(p_dados->>'id','')::uuid,gen_random_uuid());
    if exists(select 1 from public.midias where id=id_midia and produto_id<>p_id) then raise exception 'Mídia de outra peça.' using errcode='42501'; end if;
    insert into public.midias(id,produto_id,caminho_storage,tipo,alt_texto,ordem,principal,criado_por,atualizado_por)
    values(id_midia,p_id,p_dados->>'caminho_storage',p_dados->>'tipo',coalesce(nullif(btrim(p_dados->>'alt_texto'),''),'Foto da peça '||p.codigo),
      coalesce((select max(ordem)+1 from public.midias where produto_id=p_id),0),
      p_dados->>'tipo'='foto' and not exists(select 1 from public.midias where produto_id=p_id and principal),auth.uid(),auth.uid())
    on conflict(id) do nothing;
    update public.produtos set atualizado_por=auth.uid() where id=p_id;
  elsif p_acao in ('midia_capa','midia_arquivar') then
    id_midia:=(p_dados->>'midia_id')::uuid;
    if not exists(select 1 from public.midias where id=id_midia and produto_id=p_id and arquivado_em is null
      and (p_acao<>'midia_capa' or tipo='foto')) then raise exception 'Mídia inválida.' using errcode='22023'; end if;
    if p_acao='midia_capa' then
      update public.midias set principal=false,atualizado_por=auth.uid() where produto_id=p_id and principal;
      update public.midias set principal=true,ativo=true,atualizado_por=auth.uid() where id=id_midia;
    else
      if p.ativo and exists(select 1 from public.midias where id=id_midia and principal) then
        raise exception 'Escolha outra capa ou retire a peça da vitrine antes de remover a capa.' using errcode='23514'; end if;
      update public.midias set ativo=false,principal=false,arquivado_em=now(),atualizado_por=auth.uid() where id=id_midia;
    end if;
    update public.produtos set atualizado_por=auth.uid() where id=p_id;
  else raise exception 'Operação não permitida.' using errcode='22023';
  end if;
  return private.catalogo_snapshot(p_id);
end $$;

create function public.operar_catalogo(p_acao text,p_id uuid default null,p_dados jsonb default '{}'::jsonb,p_correlation_id uuid default gen_random_uuid()) returns jsonb
language sql set search_path='' as $$ select private.operar_catalogo(p_acao,p_id,p_dados,p_correlation_id); $$;
revoke all on function public.operar_catalogo(text,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function private.operar_catalogo(text,uuid,jsonb,uuid),private.pode_gerir_catalogo(),private.midia_catalogo_permitida(text),private.catalogo_snapshot(uuid),private.auditar_equipe() from public,anon,authenticated,service_role;
grant execute on function public.operar_catalogo(text,uuid,jsonb,uuid),private.operar_catalogo(text,uuid,jsonb,uuid),private.pode_gerir_catalogo(),private.midia_catalogo_permitida(text) to authenticated;
commit;
