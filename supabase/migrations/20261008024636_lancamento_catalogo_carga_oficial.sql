-- Construção. Banco único explicitamente aprovado por Yasmin; sem apagar históricos.
begin;
alter table public.produtos add column dado_teste boolean not null default false;
alter table public.produtos add column lote_lancamento_id uuid;
alter table public.produtos add column ordem_vitrine integer not null default 0 check(ordem_vitrine>=0);
alter table public.colecoes add column dado_teste boolean not null default false;
alter table public.profiles add column dado_teste boolean not null default false;
alter table public.clientes add column dado_teste boolean not null default false;
alter table public.pedidos add column dado_teste boolean not null default false;
alter table public.pedidos add column arquivado_em timestamptz;
create index produtos_lote_lancamento_idx on public.produtos(lote_lancamento_id) where lote_lancamento_id is not null;
create index pedidos_arquivo_idx on public.pedidos(arquivado_em);
-- Teste rastreável: prefixos reservados, nunca inferência por nome de pessoa.
update public.produtos set dado_teste=true where codigo like 'HOM-RM%' or codigo='SMOKE-01';
update public.profiles p set dado_teste=true from auth.users a where a.id=p.user_id and a.email like 'teste+%';
update public.clientes c set dado_teste=true from public.profiles p where p.user_id=c.auth_user_id and p.dado_teste;
update public.pedidos p set dado_teste=true from public.clientes c where c.id=p.cliente_id and c.dado_teste;

create function private.teste_visivel() returns boolean language sql stable set search_path='' as $$
 select now() < '2026-10-09 18:00:00-03'::timestamptz;
$$;
revoke all on function private.teste_visivel() from public,anon,authenticated,service_role;
grant execute on function private.teste_visivel() to anon,authenticated,service_role;
alter policy produtos_publicos on public.produtos using (
 ativo and arquivado_em is null and status_catalogo='publicado' and (not dado_teste or private.teste_visivel())
 and exists(select 1 from public.categorias c where c.id=categoria_id)
 and (colecao_id is null or exists(select 1 from public.colecoes co where co.id=colecao_id))
);
alter policy colecoes_publicas on public.colecoes using(ativo and arquivado_em is null and (not dado_teste or private.teste_visivel()));
grant select(ordem_vitrine,dado_teste) on public.produtos to anon,authenticated;
create or replace function private.saldo_publico(p_variacao_id uuid) returns integer
language sql stable security definer set search_path='' as $$
 select v.estoque_fisico-v.estoque_reservado from public.variacoes v
 join public.produtos p on p.id=v.produto_id join public.categorias c on c.id=p.categoria_id
 left join public.colecoes co on co.id=p.colecao_id
 where v.id=p_variacao_id and v.ativo and v.arquivado_em is null and p.ativo and p.arquivado_em is null
 and p.status_catalogo='publicado' and (not p.dado_teste or private.teste_visivel())
 and c.ativo and c.arquivado_em is null and (p.colecao_id is null or(co.ativo and co.arquivado_em is null));
$$;
create or replace function private.e_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
 and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and p.ativo and(not p.dado_teste or private.teste_visivel()))
 and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt()->'amr')='array' then auth.jwt()->'amr' else '[]'::jsonb end) m where m->>'method'='password');
$$;
create or replace function public.meu_acesso() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('role',p.role,'ativo',p.ativo and (not p.dado_teste or private.teste_visivel()),'admin_autorizado',private.e_admin())
 from public.profiles p where p.user_id=auth.uid();
$$;
grant select(dado_teste) on public.profiles to authenticated;
create or replace function private.cliente_atual_id() returns uuid language sql stable security definer set search_path='' as $$
 select c.id from public.clientes c join public.profiles p on p.user_id=c.auth_user_id
 where c.auth_user_id=auth.uid() and p.role='cliente' and p.ativo and c.ativo and c.arquivado_em is null
 and c.mesclado_em_cliente_id is null and(not c.dado_teste or private.teste_visivel())
 and(not p.dado_teste or private.teste_visivel()) and coalesce(auth.jwt()->>'is_anonymous','false')<>'true';
$$;
alter policy pedidos_leitura on public.pedidos using(arquivado_em is null and(not dado_teste or private.teste_visivel()) and(cliente_id=(select private.cliente_atual_id()) or(select private.e_admin())));
alter policy clientes_leitura on public.clientes using(ativo and arquivado_em is null and(not dado_teste or private.teste_visivel()) and(id=(select private.cliente_atual_id()) or(select private.e_admin())));

create table private.lotes_catalogo(
 id uuid primary key, manifesto jsonb not null, backup_referencia text not null check(length(btrim(backup_referencia))>0),
 assinatura_anterior text not null, resultado jsonb not null, criado_por uuid not null references auth.users(id) on delete restrict,
 criado_em timestamptz not null default now(), despublicado_em timestamptz
);
alter table private.lotes_catalogo enable row level security;
revoke all on private.lotes_catalogo from public,anon,authenticated,service_role;
create trigger impedir_exclusao before delete on private.lotes_catalogo for each row execute function private.bloquear_exclusao();
create trigger impedir_truncate before truncate on private.lotes_catalogo for each statement execute function private.bloquear_exclusao();
create trigger registrar_auditoria after insert or update on private.lotes_catalogo for each row execute function private.registrar_auditoria();

create function private.assinatura_catalogo() returns text language sql stable set search_path='' as $$
 select md5(coalesce(string_agg(id::text||':'||atualizado_em::text,',' order by id),'')) from public.produtos;
$$;
create function private.arquivar_dados_teste() returns void language plpgsql set search_path='' as $$
begin
 update public.produtos set ativo=false,status_catalogo='rascunho',arquivado_em=coalesce(arquivado_em,now()) where dado_teste;
 update public.variacoes v set ativo=false,arquivado_em=coalesce(v.arquivado_em,now()) from public.produtos p where p.id=v.produto_id and p.dado_teste;
 update public.medidas_tamanho m set ativo=false,arquivado_em=coalesce(m.arquivado_em,now()) from public.produtos p where p.id=m.produto_id and p.dado_teste;
 update public.colecoes set ativo=false,atual=false,arquivado_em=coalesce(arquivado_em,now()) where dado_teste;
 update public.profiles set ativo=false where dado_teste;
 update public.clientes set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where dado_teste;
 update public.pedidos set arquivado_em=coalesce(arquivado_em,now()) where dado_teste;
 -- Fotos não são removidas aqui. Somente a carga oficial, após commit, pode retirá-las.
end $$;
revoke all on function private.assinatura_catalogo(),private.arquivar_dados_teste() from public,anon,authenticated,service_role;
create function public.encerrar_testes_lancamento() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.e_admin() then raise exception 'Somente admin por senha.' using errcode='42501';end if;
 if private.teste_visivel() then raise exception 'O prazo de testes ainda não terminou.' using errcode='22023';end if;
 perform private.arquivar_dados_teste();
end $$;
revoke all on function public.encerrar_testes_lancamento() from public,anon,authenticated,service_role;
grant execute on function public.encerrar_testes_lancamento() to authenticated;

-- RPC de contexto/backup: somente admin por senha. Não inclui senhas/tokens/sessões.
create function public.contexto_carga_oficial() returns jsonb language plpgsql security definer set search_path='' as $$
declare dados jsonb:='{}'; privadas jsonb:='{}'; t record;
begin
 if not private.e_admin() then raise exception 'Somente admin por senha.' using errcode='42501';end if;
 -- Monta snapshot completo das tabelas públicas, não apenas catálogo.
 dados:='{}';
 for t in select tablename from pg_catalog.pg_tables where schemaname='public' order by tablename loop
   declare parte jsonb; begin
    execute format('select jsonb_build_object(%L,coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb)) from public.%I x',t.tablename,t.tablename) into parte;
    dados:=dados||parte;
   end;
 end loop;
 for t in select tablename from pg_catalog.pg_tables where schemaname='private' and tablename in('lotes_catalogo','conciliacoes_clientes') loop
  declare parte jsonb;begin
   execute format('select jsonb_build_object(%L,coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb)) from private.%I x',t.tablename,t.tablename) into parte;
   privadas:=privadas||parte;
  end;
 end loop;
 return jsonb_build_object('assinatura',private.assinatura_catalogo(),'categorias',(select jsonb_agg(to_jsonb(c)) from public.categorias c where ativo and arquivado_em is null),
 'produtos',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.produtos p),
 'fotos_anteriores',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.midias m where m.tipo='foto' and exists(select 1 from storage.objects o where o.bucket_id='produtos-publico' and o.name=m.caminho_storage)),
 'snapshot',jsonb_build_object('exportado_em',now(),'tabelas',dados,'privadas',privadas,'lotes',(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from private.lotes_catalogo l),
 'auth_referencias',(select jsonb_agg(jsonb_build_object('id',id,'email',email)) from auth.users)));
end $$;
revoke all on function public.contexto_carga_oficial() from public,anon,authenticated,service_role;
grant execute on function public.contexto_carga_oficial() to authenticated;

-- Storage é preparado pelo script antes da única transação do catálogo.
-- Nunca manipular bytes por SQL. Staging e cópias antigas ficam em bucket privado.
insert into storage.buckets(id,name,public) values('catalogo-privado','catalogo-privado',false);
create policy carga_privada_admin on storage.objects for select to authenticated using(bucket_id='catalogo-privado' and(select private.e_admin()));
create policy carga_privada_insert_admin on storage.objects for insert to authenticated with check(bucket_id='catalogo-privado' and(select private.e_admin()));
create policy carga_privada_delete_admin on storage.objects for delete to authenticated using(bucket_id='catalogo-privado' and(select private.e_admin()));
create policy carga_publica_insert_admin on storage.objects for insert to authenticated with check(bucket_id='produtos-publico' and name ~ '^lancamento/[0-9a-f-]{36}/[A-Z0-9-]+/[0-9]+\.webp$' and(select private.e_admin()));
create function private.midia_sem_vinculo(p_nome text) returns boolean language sql stable security definer set search_path='' as $$
 select private.e_admin() and not exists(select 1 from public.midias where caminho_storage=p_nome and ativo and arquivado_em is null)
 and not exists(select 1 from public.configuracoes where chave='logo_caminho' and valor=to_jsonb(p_nome));
$$;
revoke all on function private.midia_sem_vinculo(text) from public,anon,authenticated,service_role;
grant execute on function private.midia_sem_vinculo(text) to authenticated;
create policy carga_publica_remover_admin on storage.objects for delete to authenticated using(bucket_id='produtos-publico' and(select private.e_admin()) and private.midia_sem_vinculo(name));

create function public.aplicar_carga_oficial(p_lote uuid,p_manifesto jsonb,p_assinatura text,p_backup text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;foto jsonb;pid uuid;vid uuid;cid uuid;col uuid;v public.variacoes;publicadas integer:=0;rascunhos integer:=0;arquivadas integer;resultado jsonb;
begin
 if not private.e_admin() then raise exception 'Somente admin por senha.' using errcode='42501';end if;
 if p_lote is null or nullif(btrim(p_backup),'') is null or jsonb_typeof(p_manifesto) is distinct from 'array' or jsonb_array_length(p_manifesto)=0 then raise exception 'Carga ou backup inválido.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(73652026);
 if exists(select 1 from private.lotes_catalogo where id=p_lote) then
  if (select despublicado_em from private.lotes_catalogo where id=p_lote) is not null then raise exception 'Lote já despublicado. Não será republicado automaticamente.' using errcode='22023';end if;
  if (select manifesto from private.lotes_catalogo where id=p_lote)<>p_manifesto then raise exception 'Lote já utilizado com outros dados.';end if;
  return(select l.resultado from private.lotes_catalogo l where l.id=p_lote);
 end if;
 lock table public.produtos,public.variacoes,public.midias in share row exclusive mode;
 if p_assinatura is distinct from private.assinatura_catalogo() then raise exception 'O catálogo mudou após a validação. Valide e gere um novo backup.' using errcode='40001';end if;
 if(select count(distinct x->>'codigo') from jsonb_array_elements(p_manifesto) x)<>jsonb_array_length(p_manifesto) then raise exception 'Código duplicado na planilha.' using errcode='22023';end if;
 -- Validar todo o lote novamente no servidor antes do primeiro UPDATE.
 for item in select value from jsonb_array_elements(p_manifesto) loop
  if item->>'codigo' !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' or nullif(btrim(item->>'nome'),'') is null or nullif(btrim(item->>'descricao_curta'),'') is null
   or nullif(btrim(item->>'cor'),'') is null or nullif(btrim(item->>'tamanho'),'') is null
   or item->>'preco' is null or item->>'estoque' is null or item->>'publicar' is null or jsonb_typeof(item->'fotos') is distinct from 'array' or (item->>'preco')::numeric<=0 or (item->>'preco')::numeric>9999999999.99
   or coalesce((item->>'preco_promocional')::numeric,-1)>= (item->>'preco')::numeric
   or ((item->>'preco_promocional') is not null and(item->>'preco_promocional')::numeric<0)
   or (item->>'estoque')::integer<0 or item->>'publicar' not in('sim','não')
   or not exists(select 1 from public.categorias where nome=item->>'categoria' and ativo and arquivado_em is null)
   or ((item->>'publicar'='sim') and not exists(select 1 from jsonb_array_elements(item->'fotos') f where(f->>'ordem')::integer=1))
   then raise exception 'Dados inválidos na peça %.',item->>'codigo' using errcode='22023';end if;
  for foto in select value from jsonb_array_elements(item->'fotos') loop
   if foto->>'caminho' !~ ('^lancamento/'||p_lote::text||'/'||(item->>'codigo')||'/[0-9]+\.webp$')
    or not exists(select 1 from storage.objects where bucket_id='produtos-publico' and name=foto->>'caminho') then raise exception 'Foto não preparada: %.',foto->>'caminho' using errcode='22023';end if;
  end loop;
 end loop;
 perform set_config('app.correlation_id',p_lote::text,true);
 select id into col from public.colecoes where atual and arquivado_em is null limit 1;
 if col is null then insert into public.colecoes(nome,slug,atual) values('Coleção de lançamento','colecao-lancamento',true) returning id into col;
 else update public.colecoes set nome='Coleção de lançamento',dado_teste=false,ativo=true,arquivado_em=null where id=col;end if;
 update public.produtos p set ativo=false,status_catalogo='rascunho',arquivado_em=coalesce(arquivado_em,now()) where not exists(select 1 from jsonb_array_elements(p_manifesto) x where x->>'codigo'=p.codigo) and p.arquivado_em is null;
 get diagnostics arquivadas=row_count;
 for item in select value from jsonb_array_elements(p_manifesto) loop
  select id into cid from public.categorias where nome=item->>'categoria' and ativo and arquivado_em is null;
  insert into public.produtos(codigo,nome,slug,descricao,categoria_id,colecao_id,preco,preco_promocional,status_catalogo,ativo,dado_teste,lote_lancamento_id,ordem_vitrine,observacoes_curadoria,criado_por,atualizado_por)
  values(item->>'codigo',item->>'nome','peca-'||lower(item->>'codigo'),item->>'descricao_curta',cid,col,(item->>'preco')::numeric,(item->>'preco_promocional')::numeric,'rascunho',false,false,p_lote,coalesce((item->>'ordem_vitrine')::integer,0),coalesce(item->>'observacoes',''),auth.uid(),auth.uid())
  on conflict(codigo) do update set nome=excluded.nome,descricao=excluded.descricao,categoria_id=excluded.categoria_id,colecao_id=excluded.colecao_id,
  preco=excluded.preco,preco_promocional=excluded.preco_promocional,status_catalogo='rascunho',ativo=false,arquivado_em=null,dado_teste=false,lote_lancamento_id=p_lote,ordem_vitrine=excluded.ordem_vitrine,observacoes_curadoria=excluded.observacoes_curadoria,modelo_veste=null,selo=null,atualizado_por=auth.uid()
  returning id into pid;
  -- Mantém IDs e históricos. Medidas fictícias deixam de participar do catálogo.
  update public.medidas_tamanho set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where produto_id=pid;
  select id into vid from public.variacoes where produto_id=pid and tamanho=item->>'tamanho' and cor=item->>'cor';
  for v in select * from public.variacoes where produto_id=pid for update loop
    if v.id is distinct from vid then
     if v.estoque_fisico<>0 then perform public.ajustar_estoque(v.id,-v.estoque_fisico,'Substituição pelo estoque oficial',p_lote);end if;
     update public.variacoes set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where id=v.id;
    end if;
  end loop;
  if vid is null then
   insert into public.variacoes(produto_id,sku,tamanho,cor,criado_por,atualizado_por) values(pid,item->>'codigo'||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),item->>'tamanho',item->>'cor',auth.uid(),auth.uid()) returning id into vid;
  else update public.variacoes set ativo=true,arquivado_em=null,atualizado_por=auth.uid() where id=vid;end if;
  select * into v from public.variacoes where id=vid for update;
  if v.estoque_fisico<>(item->>'estoque')::integer then perform public.ajustar_estoque(vid,(item->>'estoque')::integer-v.estoque_fisico,'Carga oficial de lançamento',p_lote);end if;
  update public.midias set ativo=false,principal=false,arquivado_em=coalesce(arquivado_em,now()),atualizado_por=auth.uid() where produto_id=pid;
  for foto in select value from jsonb_array_elements(item->'fotos') loop
   insert into public.midias(produto_id,caminho_storage,tipo,alt_texto,ordem,principal,criado_por,atualizado_por)
   values(pid,foto->>'caminho','foto',(item->>'nome')||' · '||(item->>'cor'),(foto->>'ordem')::integer,(foto->>'ordem')::integer=1,auth.uid(),auth.uid());
  end loop;
  update public.produtos set status_catalogo=case when item->>'publicar'='sim' then 'publicado' else 'rascunho' end,ativo=item->>'publicar'='sim' where id=pid;
  if item->>'publicar'='sim' then publicadas:=publicadas+1;else rascunhos:=rascunhos+1;end if;
 end loop;
 perform private.arquivar_dados_teste();
 -- Fotos de peças ausentes também são desvinculadas antes de retirar os objetos públicos.
 update public.midias m set ativo=false,principal=false,arquivado_em=coalesce(m.arquivado_em,now()) from public.produtos p where p.id=m.produto_id and p.arquivado_em is not null;
 resultado:=jsonb_build_object('lote',p_lote,'publicadas',publicadas,'rascunhos',rascunhos,'arquivadas',arquivadas,'fotos',(select coalesce(sum(jsonb_array_length(x->'fotos')),0) from jsonb_array_elements(p_manifesto) x));
 insert into private.lotes_catalogo(id,manifesto,backup_referencia,assinatura_anterior,resultado,criado_por) values(p_lote,p_manifesto,p_backup,p_assinatura,resultado,auth.uid());
 return resultado;
end $$;
revoke all on function public.aplicar_carga_oficial(uuid,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function public.aplicar_carga_oficial(uuid,jsonb,text,text) to authenticated;
create function public.despublicar_carga_oficial(p_lote uuid) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not private.e_admin() then raise exception 'Somente admin por senha.' using errcode='42501';end if;
 if not exists(select 1 from private.lotes_catalogo where id=p_lote) then raise exception 'Lote não encontrado.' using errcode='22023';end if;
 perform set_config('app.correlation_id',p_lote::text,true);
 update public.produtos set ativo=false,status_catalogo='rascunho',atualizado_por=auth.uid() where lote_lancamento_id=p_lote;
 get diagnostics n=row_count;
 update private.lotes_catalogo set despublicado_em=now() where id=p_lote;
 return n;
end $$;
revoke all on function public.despublicar_carga_oficial(uuid) from public,anon,authenticated,service_role;
grant execute on function public.despublicar_carga_oficial(uuid) to authenticated;
-- O registro anterior permanece como histórico. Nunca executar seeds de homologação no hospedado.
insert into public.configuracoes(chave,valor,descricao) values('ambiente_producao','{"project_ref":"kernpudxhwkpoadahgqj","uso":"producao","banco_unico":true}','Decisão explícita da Yasmin em 08/10/2026') on conflict(chave) do update set valor=excluded.valor;
create or replace function private.operar_catalogo(p_acao text,p_id uuid,p_dados jsonb,p_correlation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.produtos; v public.variacoes; item jsonb; uid uuid; id_midia uuid; pagina integer; resultado jsonb; preco_venda numeric(12,2); preco_oferta numeric(12,2);
begin
  if not private.pode_gerir_catalogo() then raise exception 'Sessão de acesso e equipe autorizada são obrigatórias.' using errcode='42501'; end if;
  if p_correlation_id is null or jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;
  perform set_config('app.correlation_id',p_correlation_id::text,true);
  if p_acao='listar' then
    pagina := greatest(0,coalesce((p_dados->>'pagina')::integer,0));
    select jsonb_build_object('itens',coalesce(jsonb_agg(private.catalogo_snapshot(x.id)),'[]'::jsonb)) into resultado
    from (select id from public.produtos where arquivado_em is null and (not dado_teste or private.teste_visivel())
      and (coalesce(p_dados->>'status','')='' or status_catalogo=p_dados->>'status')
      and (coalesce(p_dados->>'busca','')='' or coalesce(nome,'')||' '||codigo ilike '%'||(p_dados->>'busca')||'%')
      order by criado_em desc,id limit 48 offset pagina*48) x;
    return resultado || jsonb_build_object(
      'total',(select count(*) from public.produtos where arquivado_em is null and (not dado_teste or private.teste_visivel())
        and (coalesce(p_dados->>'status','')='' or status_catalogo=p_dados->>'status')
        and (coalesce(p_dados->>'busca','')='' or coalesce(nome,'')||' '||codigo ilike '%'||(p_dados->>'busca')||'%')),
      'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by ordem,nome) from public.categorias where ativo and arquivado_em is null),'[]'::jsonb),
      'colecoes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome,'atual',atual) order by inicio desc nulls last) from public.colecoes where ativo and arquivado_em is null),'[]'::jsonb));
  end if;
  if p_id is null then raise exception 'Peça não informada.' using errcode='22023'; end if;
  if p_acao='criar' then
    insert into public.produtos(id,codigo,slug,nome,categoria_id,colecao_id,preco,status_catalogo,ativo,criado_por,atualizado_por)
    values(p_id,'RM-'||upper(substr(replace(p_id::text,'-',''),1,12)),'rm-'||replace(p_id::text,'-',''),null,null,(select id from public.colecoes where atual and ativo and arquivado_em is null),null,'rascunho',false,auth.uid(),auth.uid())
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
    preco_venda:=nullif(p_dados->>'preco','')::numeric;
    preco_oferta:=nullif(p_dados->>'preco_promocional','')::numeric;
    if preco_venda is not null and preco_venda<=0 then
      raise exception 'O preço de venda deve ser maior que zero.' using errcode='23514';
    end if;
    if preco_oferta is not null and preco_oferta<0 then
      raise exception 'O preço promocional deve ser um valor válido em reais.' using errcode='23514';
    end if;
    if preco_oferta is not null and preco_venda is null then
      raise exception 'Informe o preço de venda antes de definir uma promoção.' using errcode='23514';
    end if;
    if preco_oferta is not null and preco_oferta>=preco_venda then
      raise exception 'O preço promocional deve ser menor que o preço de venda. Para vender pelo mesmo valor, deixe a promoção vazia.' using errcode='23514';
    end if;
    update public.produtos set nome=nullif(btrim(p_dados->>'nome'),''), descricao=coalesce(p_dados->>'descricao',''),
      categoria_id=nullif(p_dados->>'categoria_id','')::uuid,colecao_id=nullif(p_dados->>'colecao_id','')::uuid,
      preco=preco_venda,preco_promocional=preco_oferta,
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
commit;
