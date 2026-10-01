-- Construção: tarefa 1 da Fase 0, conforme Arquitetura V2.
-- Apenas nove tabelas de negócio. Auth e Storage são infraestrutura do Supabase.
begin;

create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ordem integer not null default 0 check (ordem >= 0),
  ativo boolean not null default true,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete restrict,
  check (arquivado_em is null or not ativo)
);

create table public.colecoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  inicio date,
  fim date,
  atual boolean not null default false,
  ativo boolean not null default true,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete restrict,
  check (fim is null or inicio is null or fim >= inicio),
  check (arquivado_em is null or not ativo)
);
create unique index colecoes_unica_atual_idx on public.colecoes(atual) where atual;

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (length(btrim(codigo)) > 0 and codigo = btrim(codigo)),
  nome text not null check (length(btrim(nome)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  descricao text not null default '',
  categoria_id uuid not null references public.categorias(id) on delete restrict,
  colecao_id uuid references public.colecoes(id) on delete restrict,
  preco numeric(12,2) not null check (preco > 0 and preco <> 'NaN'::numeric),
  preco_promocional numeric(12,2),
  peso_g integer check (peso_g > 0),
  largura_dobrada_cm numeric(8,2) check (largura_dobrada_cm > 0 and largura_dobrada_cm <> 'NaN'::numeric),
  altura_dobrada_cm numeric(8,2) check (altura_dobrada_cm > 0 and altura_dobrada_cm <> 'NaN'::numeric),
  comprimento_dobrado_cm numeric(8,2) check (comprimento_dobrado_cm > 0 and comprimento_dobrado_cm <> 'NaN'::numeric),
  selo text check (selo in ('aprovado_rose', 'novidade', 'ultimas_pecas')),
  modelo_veste text,
  ativo boolean not null default true,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete restrict,
  check (preco_promocional is null or (preco_promocional >= 0 and preco_promocional < preco)),
  check (arquivado_em is null or not ativo)
);
create index produtos_categoria_id_idx on public.produtos(categoria_id);
create index produtos_colecao_id_idx on public.produtos(colecao_id);
create index produtos_ativo_idx on public.produtos(ativo);
create index produtos_nome_trgm_idx on public.produtos using gin(nome extensions.gin_trgm_ops);

create table public.variacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  sku text not null unique check (length(btrim(sku)) > 0 and sku = upper(btrim(sku))),
  tamanho text not null check (length(btrim(tamanho)) > 0),
  cor text not null check (length(btrim(cor)) > 0),
  estoque_fisico integer not null default 0 check (estoque_fisico >= 0),
  estoque_reservado integer not null default 0 check (estoque_reservado >= 0 and estoque_reservado <= estoque_fisico),
  estoque_minimo integer not null default 0 check (estoque_minimo >= 0),
  custo_medio numeric(12,2) not null default 0 check (custo_medio >= 0 and custo_medio <> 'NaN'::numeric),
  ativo boolean not null default true,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete restrict,
  unique(produto_id, tamanho, cor),
  unique(id, produto_id),
  -- Não existe reserva na Fase 0. A migration da Fase 1 remove este CHECK.
  constraint variacoes_sem_reservas_fase_0 check (estoque_reservado = 0),
  check (arquivado_em is null or not ativo)
);

create table public.medidas_tamanho (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  tamanho text not null check (length(btrim(tamanho)) > 0),
  medida text not null check (medida in ('busto', 'cintura', 'quadril', 'comprimento', 'manga', 'ombro', 'outra')),
  rotulo text not null check (length(btrim(rotulo)) > 0),
  valor_cm numeric(8,2) not null check (valor_cm > 0 and valor_cm <> 'NaN'::numeric),
  ordem integer not null default 0 check (ordem >= 0),
  ativo boolean not null default true,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete restrict,
  unique(produto_id, tamanho, medida),
  check (arquivado_em is null or not ativo)
);

create table public.midias (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  variacao_id uuid,
  caminho_storage text not null check (length(btrim(caminho_storage)) > 0),
  tipo text not null check (tipo in ('foto', 'video')),
  ordem integer not null default 0 check (ordem >= 0),
  alt_texto text not null check (length(btrim(alt_texto)) > 0),
  principal boolean not null default false,
  ativo boolean not null default true,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete restrict,
  foreign key (variacao_id, produto_id) references public.variacoes(id, produto_id) on delete restrict,
  check (arquivado_em is null or not ativo)
);
create unique index midias_unica_principal_idx on public.midias(produto_id) where principal;
create index midias_produto_ordem_idx on public.midias(produto_id, ordem);
create index midias_variacao_produto_idx on public.midias(variacao_id, produto_id);

create table public.movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  variacao_id uuid not null references public.variacoes(id) on delete restrict,
  tipo text not null check (tipo in ('entrada', 'venda', 'retorno_troca', 'avaria', 'brinde', 'uso_interno', 'ajuste_inventario', 'estorno_venda')),
  quantidade integer not null check (quantidade <> 0),
  quantidade_anterior integer not null check (quantidade_anterior >= 0),
  quantidade_posterior integer not null check (quantidade_posterior >= 0),
  motivo text not null check (length(btrim(motivo)) > 0),
  origem text not null check (length(btrim(origem)) > 0),
  correlation_id uuid not null default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  check (quantidade_posterior = quantidade_anterior + quantidade)
);
create index movimentos_estoque_variacao_criado_idx on public.movimentos_estoque(variacao_id, criado_em desc);
create index movimentos_estoque_correlation_idx on public.movimentos_estoque(correlation_id);

create table public.configuracoes (
  chave text primary key check (chave ~ '^[a-z][a-z0-9_]*$'),
  valor jsonb not null,
  descricao text not null default '',
  atualizado_por uuid references auth.users(id) on delete restrict,
  atualizado_em timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  registro_id uuid,
  acao text not null check (acao in ('create', 'update', 'delete_logico', 'status_change', 'merge', 'approve', 'cancel')),
  dados_antes jsonb,
  dados_depois jsonb,
  motivo text,
  -- Identidade Auth já existe na Fase 0; não depende de usuarios_internos.
  usuario_id uuid references auth.users(id) on delete restrict,
  origem text not null,
  contexto jsonb not null default '{}'::jsonb,
  correlation_id uuid not null default gen_random_uuid(),
  criado_em timestamptz not null default now()
);
create index audit_log_entidade_registro_criado_idx on public.audit_log(entidade, registro_id, criado_em);
create index audit_log_usuario_id_idx on public.audit_log(usuario_id);
create index audit_log_correlation_idx on public.audit_log(correlation_id);

-- Índices de autoria: todas as FKs desta fase apontam para catálogo ou auth.users.
do $$
declare tabela text;
begin
  foreach tabela in array array['categorias','colecoes','produtos','variacoes','medidas_tamanho','midias'] loop
    execute format('create index %I on public.%I(criado_por)', tabela || '_criado_por_idx', tabela);
    execute format('create index %I on public.%I(atualizado_por)', tabela || '_atualizado_por_idx', tabela);
  end loop;
end $$;
create index configuracoes_atualizado_por_idx on public.configuracoes(atualizado_por);

create function private.atualizar_timestamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := clock_timestamp();
  return new;
end $$;

create function private.bloquear_mutacao_historico() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Histórico imutável: operação % proibida em %.', tg_op, tg_table_name using errcode = '42501';
end $$;

create function private.bloquear_exclusao() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Exclusão física proibida em %. Use arquivamento.', tg_table_name using errcode = '42501';
end $$;

create function private.proteger_projecoes_estoque() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.estoque_fisico <> 0 or new.estoque_reservado <> 0 or new.custo_medio <> 0 then
      raise exception 'Variação nasce com saldo e custo zero; saldo vem do ledger.' using errcode = '42501';
    end if;
  elsif (new.estoque_fisico is distinct from old.estoque_fisico
      or new.estoque_reservado is distinct from old.estoque_reservado
      or new.custo_medio is distinct from old.custo_medio) and pg_trigger_depth() <= 1 then
    raise exception 'Projeções de estoque e custo não aceitam alteração direta.' using errcode = '42501';
  end if;
  return new;
end $$;

create function private.preparar_movimento_estoque() returns trigger
language plpgsql security definer set search_path = '' as $$
declare saldo integer;
begin
  select estoque_fisico into saldo from public.variacoes where id = new.variacao_id for update;
  if not found then
    raise exception 'Variação inexistente.' using errcode = '23503';
  end if;
  new.quantidade_anterior := saldo;
  new.quantidade_posterior := saldo + new.quantidade;
  return new;
end $$;

create function private.aplicar_movimento_estoque() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.variacoes set estoque_fisico = new.quantidade_posterior where id = new.variacao_id;
  return new;
end $$;

create function private.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = '' as $$
declare antes jsonb; depois jsonb; correlacao uuid;
begin
  if tg_op = 'UPDATE' then antes := to_jsonb(old); end if;
  depois := to_jsonb(new);
  if tg_op = 'UPDATE' and (antes - 'atualizado_em') = (depois - 'atualizado_em') then return new; end if;
  correlacao := coalesce(nullif(current_setting('app.correlation_id', true), '')::uuid,
    nullif(depois->>'correlation_id', '')::uuid, gen_random_uuid());
  insert into public.audit_log(entidade, registro_id, acao, dados_antes, dados_depois, usuario_id, origem, contexto, correlation_id)
  values (tg_table_name, (depois->>'id')::uuid,
    case when tg_op = 'INSERT' then 'create'
      when (depois->>'ativo')::boolean = false and (antes->>'ativo')::boolean = true then 'delete_logico'
      else 'update' end,
    antes, depois, auth.uid(), 'banco',
    case when tg_table_name = 'configuracoes' then jsonb_build_object('chave', depois->>'chave') else '{}'::jsonb end,
    correlacao);
  return new;
end $$;

-- Única operação de saldo da Fase 0: ajustar inventário, por servidor autorizado.
create function public.ajustar_estoque(p_variacao_id uuid, p_quantidade integer, p_motivo text,
  p_correlation_id uuid default gen_random_uuid()) returns uuid
language plpgsql security definer set search_path = '' as $$
declare movimento uuid; correlacao_anterior text;
begin
  if p_quantidade is null or p_quantidade = 0 or p_motivo is null or length(btrim(p_motivo)) = 0 or p_correlation_id is null then
    raise exception 'Informe quantidade não zero, motivo e correlação.' using errcode = '22023';
  end if;
  correlacao_anterior := current_setting('app.correlation_id', true);
  perform set_config('app.correlation_id', p_correlation_id::text, true);
  insert into public.movimentos_estoque(variacao_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, motivo, origem, correlation_id)
    values (p_variacao_id, 'ajuste_inventario', p_quantidade, 0, 0, p_motivo, 'rotina', p_correlation_id)
    returning id into movimento;
  perform set_config('app.correlation_id', coalesce(correlacao_anterior, ''), true);
  return movimento;
end $$;

-- O invoker view não pode receber SELECT nos saldos internos. Este helper retorna
-- somente o disponível de uma variação publicável, inclusive se chamado isoladamente.
create function private.saldo_publico(p_variacao_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select v.estoque_fisico - v.estoque_reservado
  from public.variacoes v
  join public.produtos p on p.id = v.produto_id
  join public.categorias c on c.id = p.categoria_id
  left join public.colecoes co on co.id = p.colecao_id
  where v.id = p_variacao_id and v.ativo and v.arquivado_em is null
    and p.ativo and p.arquivado_em is null and c.ativo and c.arquivado_em is null
    and (p.colecao_id is null or (co.ativo and co.arquivado_em is null));
$$;

do $$
declare tabela text;
begin
  foreach tabela in array array['categorias','colecoes','produtos','variacoes','medidas_tamanho','midias','configuracoes'] loop
    execute format('create trigger atualizar_timestamp before update on public.%I for each row execute function private.atualizar_timestamp()', tabela);
    execute format('create trigger impedir_exclusao before delete on public.%I for each row execute function private.bloquear_exclusao()', tabela);
    execute format('create trigger impedir_truncate before truncate on public.%I for each statement execute function private.bloquear_exclusao()', tabela);
    execute format('create trigger registrar_auditoria after insert or update on public.%I for each row execute function private.registrar_auditoria()', tabela);
  end loop;
  foreach tabela in array array['movimentos_estoque','audit_log'] loop
    execute format('create trigger impedir_mutacao before update or delete on public.%I for each row execute function private.bloquear_mutacao_historico()', tabela);
    execute format('create trigger impedir_truncate before truncate on public.%I for each statement execute function private.bloquear_mutacao_historico()', tabela);
  end loop;
end $$;
create trigger proteger_projecoes before insert or update on public.variacoes for each row execute function private.proteger_projecoes_estoque();
create trigger preparar_movimento before insert on public.movimentos_estoque for each row execute function private.preparar_movimento_estoque();
create trigger aplicar_movimento after insert on public.movimentos_estoque for each row execute function private.aplicar_movimento_estoque();
create trigger registrar_auditoria after insert on public.movimentos_estoque for each row execute function private.registrar_auditoria();

-- Segurança por linha e por coluna; nenhum papel público escreve nesta fase.
do $$
declare tabela text;
begin
  foreach tabela in array array['categorias','colecoes','produtos','variacoes','medidas_tamanho','midias','movimentos_estoque','configuracoes','audit_log'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', tabela);
  end loop;
end $$;

create policy categorias_publicas on public.categorias for select to anon, authenticated using (ativo and arquivado_em is null);
create policy colecoes_publicas on public.colecoes for select to anon, authenticated using (ativo and arquivado_em is null);
create policy produtos_publicos on public.produtos for select to anon, authenticated using (
  ativo and arquivado_em is null
  and exists(select 1 from public.categorias c where c.id = categoria_id)
  and (colecao_id is null or exists(select 1 from public.colecoes co where co.id = colecao_id))
);
create policy variacoes_publicas on public.variacoes for select to anon, authenticated using (
  ativo and arquivado_em is null and exists(select 1 from public.produtos p where p.id = produto_id)
);
create policy medidas_publicas on public.medidas_tamanho for select to anon, authenticated using (
  ativo and arquivado_em is null and exists(select 1 from public.produtos p where p.id = produto_id)
);
create policy midias_publicas on public.midias for select to anon, authenticated using (
  ativo and arquivado_em is null and exists(select 1 from public.produtos p where p.id = produto_id)
  and (variacao_id is null or exists(select 1 from public.variacoes v where v.id = variacao_id))
);
create policy configuracoes_publicas on public.configuracoes for select to anon, authenticated using (
  chave in ('nome_loja', 'descricao_loja', 'logo_caminho')
);

grant usage on schema public, private to anon, authenticated, service_role;
grant select(id, nome, slug, ordem, ativo, arquivado_em) on public.categorias to anon, authenticated;
grant select(id, nome, slug, inicio, fim, atual, ativo, arquivado_em) on public.colecoes to anon, authenticated;
grant select(id, codigo, nome, slug, descricao, categoria_id, colecao_id, preco, preco_promocional, selo, modelo_veste, ativo, arquivado_em) on public.produtos to anon, authenticated;
grant select(id, produto_id, sku, tamanho, cor, ativo, arquivado_em) on public.variacoes to anon, authenticated;
grant select(id, produto_id, tamanho, medida, rotulo, valor_cm, ordem, ativo, arquivado_em) on public.medidas_tamanho to anon, authenticated;
grant select(id, produto_id, variacao_id, caminho_storage, tipo, ordem, alt_texto, principal, ativo, arquivado_em) on public.midias to anon, authenticated;
grant select(chave, valor) on public.configuracoes to anon, authenticated;

grant select, insert, update on public.categorias, public.colecoes, public.produtos, public.medidas_tamanho, public.midias, public.configuracoes to service_role;
grant select, insert on public.variacoes to service_role;
grant update(produto_id, sku, tamanho, cor, estoque_minimo, ativo, arquivado_em, criado_em, atualizado_em, criado_por, atualizado_por) on public.variacoes to service_role;
grant select on public.movimentos_estoque, public.audit_log to service_role;

revoke all on all functions in schema private from public, anon, authenticated, service_role;
revoke all on function public.ajustar_estoque(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.ajustar_estoque(uuid, integer, text, uuid) to service_role;
grant execute on function private.saldo_publico(uuid) to anon, authenticated, service_role;

create view public.v_estoque_disponivel with (security_invoker = true, security_barrier = true) as
  select id as variacao_id, produto_id, sku, tamanho, cor, private.saldo_publico(id) as disponivel
  from public.variacoes where ativo and arquivado_em is null;
revoke all on public.v_estoque_disponivel from public, anon, authenticated, service_role;
grant select on public.v_estoque_disponivel to anon, authenticated, service_role;

insert into storage.buckets(id, name, public) values ('produtos-publico', 'produtos-publico', true);
create policy produtos_publico_leitura on storage.objects for select to anon, authenticated using (bucket_id = 'produtos-publico');

commit;
