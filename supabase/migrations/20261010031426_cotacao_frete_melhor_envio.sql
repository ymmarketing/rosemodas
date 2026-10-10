-- Cotação informativa. Não cria checkout, pedido, etiqueta ou movimento de estoque.
begin;
insert into public.configuracoes(chave,valor,descricao) values
 ('frete_cep_origem','"30640140"','CEP de postagem; editável pela admin'),
 ('frete_dias_postagem','1','Dias úteis acrescentados ao prazo da transportadora'),
 ('frete_padrao_sem_categoria','{"peso_g":500,"comprimento_cm":30,"largura_cm":25,"altura_cm":5}','Embalagem padrão sem categoria ou quando faltam campos no padrão da categoria')
on conflict(chave) do nothing;
-- Preserva valores já preenchidos; completa apenas os campos vazios.
update public.categorias c set embalagem_padrao=coalesce((
 select jsonb_object_agg(k,coalesce(nullif(c.embalagem_padrao->>k,'')::numeric,v::numeric))
 from jsonb_each_text(case c.nome
  when 'Vestidos' then '{"peso_g":500,"comprimento_cm":30,"largura_cm":25,"altura_cm":5}'::jsonb
  when 'Conjuntos' then '{"peso_g":700,"comprimento_cm":30,"largura_cm":25,"altura_cm":7}'::jsonb
  when 'Macacões' then '{"peso_g":700,"comprimento_cm":30,"largura_cm":25,"altura_cm":7}'::jsonb
  when 'Blusas' then '{"peso_g":250,"comprimento_cm":25,"largura_cm":20,"altura_cm":4}'::jsonb end) e(k,v)
),'{}'::jsonb)
where nome in ('Vestidos','Conjuntos','Macacões','Blusas') and ativo and arquivado_em is null;

create table private.frete_limites (
 chave text primary key check(chave ~ '^[0-9a-f]{64}$'),
 instantes timestamptz[] not null default '{}'
);
create table private.frete_cache (
 chave text primary key check(chave ~ '^[0-9a-f]{64}$'),
 resposta jsonb not null check(jsonb_typeof(resposta)='object'),
 expira_em timestamptz not null
);
alter table private.frete_limites enable row level security;
alter table private.frete_cache enable row level security;
revoke all on private.frete_limites,private.frete_cache from public,anon,authenticated,service_role;
-- Reuso/expiração por UPDATE; nenhuma remoção física, mesmo em tabelas operacionais.
create trigger impedir_exclusao before delete on private.frete_limites for each row execute function private.bloquear_exclusao();
create trigger impedir_truncate before truncate on private.frete_limites for each statement execute function private.bloquear_exclusao();
create trigger impedir_exclusao before delete on private.frete_cache for each row execute function private.bloquear_exclusao();
create trigger impedir_truncate before truncate on private.frete_cache for each statement execute function private.bloquear_exclusao();

create function private.frete_admin_permitido() returns boolean language sql stable security definer set search_path='' as $$
 select private.e_admin() and exists(select 1 from public.usuarios_internos u where u.user_id=auth.uid() and u.papel='admin' and u.ativo and u.arquivado_em is null);
$$;
create function private.validar_embalagem_frete(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(p)='object' and (select count(*)=4 and bool_and(
  case when v ~ '^\d+(\.\d+)?$' then v::numeric>0 and v::numeric<=case when k='peso_g' then 30000 else 200 end and (k<>'peso_g' or trunc(v::numeric)=v::numeric) else false end
 ) from jsonb_each_text(p) e(k,v) where k in ('peso_g','largura_cm','altura_cm','comprimento_cm')) and (select count(*)=4 from jsonb_object_keys(p));
$$;
create function private.configurar_frete(p_acao text,p_dados jsonb,p_correlation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; id_cat uuid; cfg jsonb;
begin
 if not private.frete_admin_permitido() then raise exception 'Acesso permitido somente à admin.' using errcode='42501'; end if;
 if p_acao='salvar' then
  if p_correlation_id is null or jsonb_typeof(p_dados) is distinct from 'object'
   or coalesce(p_dados->>'cep_origem','') !~ '^\d{8}$'
   or coalesce(p_dados->>'dias_postagem','') !~ '^\d{1,2}$'
   or (p_dados->>'dias_postagem')::integer>30
   or private.validar_embalagem_frete(p_dados->'sem_categoria') is distinct from true
   or jsonb_typeof(p_dados->'categorias') is distinct from 'array'
  then raise exception 'Confira CEP, dias de postagem, peso e medidas.' using errcode='22023'; end if;
  perform set_config('app.correlation_id',p_correlation_id::text,true);
  for item in select value from jsonb_array_elements(p_dados->'categorias') loop
   if private.validar_embalagem_frete(item->'embalagem_padrao') is distinct from true then raise exception 'Confira o padrão da categoria.' using errcode='22023'; end if;
   id_cat:=(item->>'id')::uuid;
   if not exists(select 1 from public.categorias where id=id_cat and ativo and arquivado_em is null) then raise exception 'Categoria indisponível.' using errcode='22023'; end if;
   update public.categorias set embalagem_padrao=item->'embalagem_padrao',atualizado_por=auth.uid() where id=id_cat;
  end loop;
  update public.configuracoes set valor=to_jsonb(p_dados->>'cep_origem'),atualizado_por=auth.uid() where chave='frete_cep_origem';
  update public.configuracoes set valor=to_jsonb((p_dados->>'dias_postagem')::integer),atualizado_por=auth.uid() where chave='frete_dias_postagem';
  update public.configuracoes set valor=p_dados->'sem_categoria',atualizado_por=auth.uid() where chave='frete_padrao_sem_categoria';
 elsif p_acao<>'ler' then raise exception 'Operação de frete inválida.' using errcode='22023'; end if;
 select jsonb_object_agg(chave,valor) into cfg from public.configuracoes where chave in ('frete_cep_origem','frete_dias_postagem','frete_padrao_sem_categoria');
 return jsonb_build_object('cep_origem',cfg->'frete_cep_origem','dias_postagem',cfg->'frete_dias_postagem','sem_categoria',cfg->'frete_padrao_sem_categoria',
  'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome,'embalagem_padrao',embalagem_padrao) order by nome) from public.categorias where ativo and arquivado_em is null),'[]'::jsonb),
  'pecas',coalesce((select jsonb_agg(jsonb_build_object('codigo',codigo,'nome',nome,'categoria_id',categoria_id) order by codigo) from public.produtos where ativo and status_catalogo='publicado' and arquivado_em is null and not dado_teste),'[]'::jsonb));
end $$;
create function public.configurar_frete(p_acao text default 'ler',p_dados jsonb default '{}',p_correlation_id uuid default gen_random_uuid()) returns jsonb
language sql security invoker set search_path='' as $$ select private.configurar_frete(p_acao,p_dados,p_correlation_id); $$;

-- RPC de infraestrutura, acessível exclusivamente ao servidor. Não aceita preço/medidas do cliente.
create function private.frete_servidor(p_acao text,p_chave text,p_dados jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ts timestamptz:=clock_timestamp(); recentes timestamptz[]; p public.produtos; cfg jsonb; padrao jsonb;
begin
 if p_acao in ('limite','cache_ler','cache_gravar') and p_chave !~ '^[0-9a-f]{64}$' then raise exception 'Identificação inválida.' using errcode='22023'; end if;
 if p_acao='limite' then
  insert into private.frete_limites(chave) values(p_chave) on conflict do nothing;
  select instantes into recentes from private.frete_limites where chave=p_chave for update;
  recentes:=array(select t from unnest(recentes) t where t>ts-interval '60 seconds');
  if cardinality(recentes)>=20 then return jsonb_build_object('permitido',false); end if;
  update private.frete_limites set instantes=array_append(recentes,ts) where chave=p_chave;
  return jsonb_build_object('permitido',true);
 elsif p_acao='cache_ler' then
  return (select resposta from private.frete_cache where chave=p_chave and expira_em>ts);
 elsif p_acao='cache_gravar' then
  if jsonb_typeof(p_dados) is distinct from 'object' or p_dados->>'ok' is distinct from 'true' then raise exception 'Cotação inválida.' using errcode='22023'; end if;
  insert into private.frete_cache(chave,resposta,expira_em) values(p_chave,p_dados,ts+interval '1 hour')
   on conflict(chave) do update set resposta=excluded.resposta,expira_em=excluded.expira_em;
  return jsonb_build_object('ok',true);
 elsif p_acao='dados' then
  select * into p from public.produtos where codigo=p_chave and ativo and status_catalogo='publicado' and arquivado_em is null and not dado_teste
   and (categoria_id is null or exists(select 1 from public.categorias where id=categoria_id and ativo and arquivado_em is null))
   and exists(select 1 from public.midias where produto_id=produtos.id and ativo and tipo='foto' and arquivado_em is null);
  if p.id is null then return null; end if;
  if nullif(p_dados->>'variacao','') is not null and not exists(select 1 from public.variacoes where id=(p_dados->>'variacao')::uuid and produto_id=p.id and ativo and arquivado_em is null) then return null; end if;
  select jsonb_object_agg(chave,valor) into cfg from public.configuracoes where chave in ('frete_cep_origem','frete_dias_postagem','frete_padrao_sem_categoria');
  padrao:=coalesce((select embalagem_padrao from public.categorias where id=p.categoria_id),'{}');
  return jsonb_build_object('id',p.id,'codigo',p.codigo,'preco',coalesce(p.preco_promocional,p.preco),'cep_origem',cfg->'frete_cep_origem','dias_postagem',cfg->'frete_dias_postagem',
   'peso_g',coalesce(p.peso_g,nullif(padrao->>'peso_g','')::numeric,(cfg->'frete_padrao_sem_categoria'->>'peso_g')::numeric),
   'largura_cm',coalesce(p.largura_dobrada_cm,nullif(padrao->>'largura_cm','')::numeric,(cfg->'frete_padrao_sem_categoria'->>'largura_cm')::numeric),
   'altura_cm',coalesce(p.altura_dobrada_cm,nullif(padrao->>'altura_cm','')::numeric,(cfg->'frete_padrao_sem_categoria'->>'altura_cm')::numeric),
   'comprimento_cm',coalesce(p.comprimento_dobrado_cm,nullif(padrao->>'comprimento_cm','')::numeric,(cfg->'frete_padrao_sem_categoria'->>'comprimento_cm')::numeric));
 end if;
 raise exception 'Operação inválida.' using errcode='22023';
end $$;
create function public.frete_servidor(p_acao text,p_chave text default '',p_dados jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.frete_servidor(p_acao,p_chave,p_dados); $$;
revoke all on function private.frete_admin_permitido(),private.validar_embalagem_frete(jsonb),private.configurar_frete(text,jsonb,uuid),public.configurar_frete(text,jsonb,uuid),private.frete_servidor(text,text,jsonb),public.frete_servidor(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.frete_admin_permitido(),private.configurar_frete(text,jsonb,uuid),public.configurar_frete(text,jsonb,uuid) to authenticated;
grant execute on function private.frete_servidor(text,text,jsonb),public.frete_servidor(text,text,jsonb) to service_role;
commit;
