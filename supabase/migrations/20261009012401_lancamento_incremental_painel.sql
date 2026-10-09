-- Lançamento: caminhos incremental e manual; corte limita exclusivamente dados de teste.
begin;
alter table public.produtos add column assinatura_carga text;
update public.produtos set ativo=false,status_catalogo='rascunho' where codigo='RM-C011' and arquivado_em is null;
update public.colecoes set nome='Coleção de lançamento',slug='lancamento' where slug='hom-lancamento';
-- Código reservado do smoke jamais participa da vitrine, mesmo durante o teste de publicar.
alter policy produtos_publicos on public.produtos using (
 ativo and arquivado_em is null and status_catalogo='publicado' and codigo<>'SMOKE-01' and (not dado_teste or private.teste_visivel())
 and exists(select 1 from public.categorias c where c.id=categoria_id)
 and (colecao_id is null or exists(select 1 from public.colecoes co where co.id=colecao_id))
);
create or replace function private.assinatura_catalogo() returns text language sql stable set search_path='' as $$
 select md5(coalesce((select string_agg(id::text||':'||atualizado_em::text,',' order by id) from public.produtos),'')||
 coalesce((select string_agg(id::text||':'||atualizado_em::text||':'||estoque_fisico::text,',' order by id) from public.variacoes),'')||
 coalesce((select string_agg(id::text||':'||atualizado_em::text,',' order by id) from public.midias),''));
$$;
create or replace function private.saldo_publico(p_variacao_id uuid) returns integer
language sql stable security definer set search_path='' as $$
 select v.estoque_fisico-v.estoque_reservado from public.variacoes v
 join public.produtos p on p.id=v.produto_id join public.categorias c on c.id=p.categoria_id
 left join public.colecoes co on co.id=p.colecao_id
 where v.id=p_variacao_id and v.ativo and v.arquivado_em is null and p.ativo and p.arquivado_em is null
 and p.codigo<>'SMOKE-01' and p.status_catalogo='publicado' and (not p.dado_teste or private.teste_visivel())
 and c.ativo and c.arquivado_em is null and (p.colecao_id is null or(co.ativo and co.arquivado_em is null));
$$;
create or replace function private.operar_catalogo(p_acao text,p_id uuid,p_dados jsonb,p_correlation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.produtos; v public.variacoes; item jsonb; uid uuid; id_midia uuid; pagina integer; resultado jsonb; preco_venda numeric(12,2); preco_oferta numeric(12,2); codigo_novo text; midias_ids uuid[];
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
    codigo_novo:=coalesce(nullif(btrim(p_dados->>'codigo'),''),'RM-'||upper(substr(replace(p_id::text,'-',''),1,12)));
    if codigo_novo !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' then raise exception 'Código inválido. Use letras maiúsculas, números e hífen.' using errcode='22023';end if;
    select * into p from public.produtos where codigo=codigo_novo for update;
    if found then
      if not p.dado_teste and p.arquivado_em is null then return private.catalogo_snapshot(p.id);end if;
      -- Reaproveita o UUID/código, sem recuperar dados fictícios nas listas ou no editor.
      if coalesce((p_dados->>'preparar_real')::boolean,false) is not true then raise exception 'Confirme que vai preparar dados reais para este código.' using errcode='22023';end if;
      update public.variacoes set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where produto_id=p.id;
      update public.medidas_tamanho set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where produto_id=p.id;
      update public.midias set ativo=false,principal=false,arquivado_em=coalesce(arquivado_em,now()) where produto_id=p.id;
      update public.produtos set nome=null,descricao='',preco=null,preco_promocional=null,modelo_veste=null,selo=null,
        status_catalogo='rascunho',ativo=false,arquivado_em=null,dado_teste=(codigo_novo='SMOKE-01' or codigo_novo like 'HOM-%'),assinatura_carga=null,
        observacoes_curadoria='',atualizado_por=auth.uid() where id=p.id;
      return private.catalogo_snapshot(p.id);
    end if;
    insert into public.produtos(id,codigo,slug,nome,categoria_id,colecao_id,preco,status_catalogo,ativo,dado_teste,criado_por,atualizado_por)
    values(p_id,codigo_novo,'rm-'||replace(p_id::text,'-',''),null,null,(select id from public.colecoes where atual and ativo and arquivado_em is null),null,'rascunho',false,(codigo_novo='SMOKE-01' or codigo_novo like 'HOM-%'),auth.uid(),auth.uid())
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
    codigo_novo:=coalesce(nullif(btrim(p_dados->>'codigo'),''),p.codigo);
    if codigo_novo !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' then raise exception 'Código inválido.' using errcode='22023';end if;
    if p.codigo<>codigo_novo and exists(select 1 from public.produtos where codigo=codigo_novo) then raise exception 'Código já cadastrado. Abra a peça existente.' using errcode='22023';end if;
    if p.dado_teste and coalesce((p_dados->>'confirmar_real')::boolean,false) and codigo_novo<>'SMOKE-01' and codigo_novo not like 'HOM-%' then
      update public.medidas_tamanho set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where produto_id=p_id;
      update public.variacoes set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where produto_id=p_id and not exists(select 1 from jsonb_array_elements(coalesce(p_dados->'variacoes','[]')) x where x->>'id'=id::text);
    end if;
    update public.produtos set codigo=codigo_novo,dado_teste=case when codigo_novo='SMOKE-01' or codigo_novo like 'HOM-%' then true when coalesce((p_dados->>'confirmar_real')::boolean,false) then false else dado_teste end, nome=nullif(btrim(p_dados->>'nome'),''), descricao=coalesce(p_dados->>'descricao',''),
      categoria_id=nullif(p_dados->>'categoria_id','')::uuid,colecao_id=nullif(p_dados->>'colecao_id','')::uuid,
      preco=preco_venda,preco_promocional=preco_oferta,
      modelo_veste=nullif(p_dados->>'modelo_veste',''),atualizado_por=auth.uid() where id=p_id;
    for item in select value from jsonb_array_elements(coalesce(p_dados->'variacoes','[]'::jsonb)) loop
      uid:=coalesce(nullif(item->>'id','')::uuid,gen_random_uuid());
      if not exists(select 1 from public.variacoes where id=uid) then select coalesce((select id from public.variacoes where produto_id=p_id and tamanho=btrim(item->>'tamanho') and cor=btrim(item->>'cor')),uid) into uid;end if;
      select * into v from public.variacoes where id=uid for update;
      if found and v.produto_id<>p_id then raise exception 'Variação de outra peça.' using errcode='42501'; end if;
      if nullif(btrim(item->>'tamanho'),'') is null or nullif(btrim(item->>'cor'),'') is null
        or coalesce(item->>'quantidade','') !~ '^\d+$' or (item->>'quantidade')::numeric>2147483647 then
        raise exception 'Informe tamanho, cor e quantidade válida da variação.' using errcode='22023'; end if;
      insert into public.variacoes(id,produto_id,sku,tamanho,cor,ativo,criado_por,atualizado_por)
      values(uid,p_id,coalesce(nullif(btrim(item->>'sku'),''),p.codigo||'-'||upper(substr(replace(uid::text,'-',''),1,8))),
        btrim(item->>'tamanho'),btrim(item->>'cor'),coalesce((item->>'ativo')::boolean,true),auth.uid(),auth.uid())
      on conflict(id) do update set sku=excluded.sku,tamanho=excluded.tamanho,cor=excluded.cor,ativo=excluded.ativo,arquivado_em=null,atualizado_por=auth.uid();
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
      on conflict(id) do update set tamanho=excluded.tamanho,medida=excluded.medida,rotulo=excluded.rotulo,valor_cm=excluded.valor_cm,ativo=excluded.ativo,arquivado_em=null,atualizado_por=auth.uid();
    end loop;
  elsif p_acao='publicar' then
    if p.dado_teste and not private.teste_visivel() and p.codigo<>'SMOKE-01' then raise exception 'Dados de teste encerrados. Salve os dados reais e confirme a revisão antes de publicar.' using errcode='22023';end if;
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
  elsif p_acao='midia_ordenar' then
    if jsonb_typeof(p_dados->'ids') is distinct from 'array' then raise exception 'Informe a ordem completa das fotos.' using errcode='22023';end if;
    select array_agg(value::uuid) into midias_ids from jsonb_array_elements_text(p_dados->'ids');
    if coalesce(array_length(midias_ids,1),0)<>(select count(*) from public.midias where produto_id=p_id and ativo and arquivado_em is null)
      or (select count(distinct x) from unnest(midias_ids) x)<>array_length(midias_ids,1)
      or exists(select 1 from unnest(midias_ids) x where not exists(select 1 from public.midias where id=x and produto_id=p_id and ativo and arquivado_em is null)) then
      raise exception 'Ordem inválida ou mídia de outra peça.' using errcode='22023';end if;
    update public.midias m set ordem=x.pos-1,atualizado_por=auth.uid() from unnest(midias_ids) with ordinality x(id,pos) where m.id=x.id;
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
create or replace function public.aplicar_carga_oficial(p_lote uuid,p_manifesto jsonb,p_assinatura text,p_backup text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;foto jsonb;variacao jsonb;vars jsonb;pid uuid;vid uuid;cid uuid;col uuid;v public.variacoes;anterior public.produtos;
 publicadas integer:=0;sem_alteracao integer:=0;total_fotos integer:=0;total_vars integer:=0;resultado jsonb;
begin
 if not private.e_admin() then raise exception 'Somente admin por senha.' using errcode='42501';end if;
 if p_lote is null or nullif(btrim(p_backup),'') is null or jsonb_typeof(p_manifesto) is distinct from 'array' or jsonb_array_length(p_manifesto)=0 then raise exception 'Carga ou backup inválido.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(73652026);
 if exists(select 1 from private.lotes_catalogo where id=p_lote) then
  if(select despublicado_em from private.lotes_catalogo where id=p_lote) is not null then raise exception 'Lote já despublicado. Não será republicado automaticamente.' using errcode='22023';end if;
  if(select manifesto from private.lotes_catalogo where id=p_lote)<>p_manifesto then raise exception 'Lote já utilizado com outros dados.' using errcode='22023';end if;
  return(select l.resultado from private.lotes_catalogo l where l.id=p_lote);
 end if;
 lock table public.produtos,public.variacoes,public.midias in share row exclusive mode;
 if p_assinatura is distinct from private.assinatura_catalogo() then raise exception 'O catálogo mudou após a validação. Valide e gere um novo backup.' using errcode='40001';end if;
 if(select count(distinct x->>'codigo') from jsonb_array_elements(p_manifesto) x)<>jsonb_array_length(p_manifesto) then raise exception 'Código duplicado no manifesto agrupado.' using errcode='22023';end if;
 -- Revalidação completa antes de modificar qualquer peça. Linhas não publicadas já são ignoradas pelo leitor.
 for item in select value from jsonb_array_elements(p_manifesto) loop
  if coalesce(item->>'publicar','')<>'sim' then continue;end if;
  if coalesce(item->>'codigo','') !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' or item->>'codigo'='SMOKE-01' or item->>'codigo' like 'HOM-%'
   or nullif(btrim(item->>'nome'),'') is null or coalesce(item->>'preco','') !~ '^\d+(\.\d{1,2})?$'
   or (item->>'preco')::numeric<=0 or (item->>'preco')::numeric>9999999999.99
   or ((item->>'preco_promocional') is not null and ((item->>'preco_promocional')::numeric<0 or (item->>'preco_promocional')::numeric>=(item->>'preco')::numeric))
   or not exists(select 1 from public.categorias where nome=item->>'categoria' and ativo and arquivado_em is null)
   or jsonb_typeof(item->'fotos') is distinct from 'array'
   or not exists(select 1 from jsonb_array_elements(item->'fotos') f where(f->>'ordem')::integer=1)
   or (item->>'assinatura_carga' is not null and item->>'assinatura_carga' !~ '^[a-f0-9]{64}$')
   then raise exception 'Dados inválidos na peça %.',item->>'codigo' using errcode='22023';end if;
  vars:=coalesce(item->'variacoes',jsonb_build_array(jsonb_build_object('cor',item->>'cor','tamanho',item->>'tamanho','estoque',item->'estoque')));
  if jsonb_typeof(vars) is distinct from 'array' or jsonb_array_length(vars)=0 then raise exception 'Informe variações para %.',item->>'codigo' using errcode='22023';end if;
  if(select count(distinct jsonb_build_array(x->>'cor',x->>'tamanho')) from jsonb_array_elements(vars) x)<>jsonb_array_length(vars) then raise exception 'Combinação código + cor + tamanho duplicada em %.',item->>'codigo' using errcode='22023';end if;
  for variacao in select value from jsonb_array_elements(vars) loop
   if nullif(btrim(variacao->>'cor'),'') is null or nullif(btrim(variacao->>'tamanho'),'') is null
    or coalesce(variacao->>'estoque','') !~ '^\d+$' or (variacao->>'estoque')::numeric>2147483647 then raise exception 'Variação inválida em %.',item->>'codigo' using errcode='22023';end if;
  end loop;
  for foto in select value from jsonb_array_elements(item->'fotos') loop
   if coalesce(foto->>'caminho','') !~ ('^lancamento/'||p_lote::text||'/'||(item->>'codigo')||'/[0-9]+\.webp$')
    or not exists(select 1 from storage.objects where bucket_id='produtos-publico' and name=foto->>'caminho') then raise exception 'Foto não preparada: %.',foto->>'caminho' using errcode='22023';end if;
  end loop;
 end loop;
 perform set_config('app.correlation_id',p_lote::text,true);
 select id into col from public.colecoes where atual and arquivado_em is null limit 1;
 if col is null then insert into public.colecoes(nome,slug,atual) values('Coleção de lançamento','lancamento',true) returning id into col;
 else update public.colecoes set nome='Coleção de lançamento',slug='lancamento',dado_teste=false,ativo=true,arquivado_em=null where id=col;end if;
 for item in select value from jsonb_array_elements(p_manifesto) loop
  if coalesce(item->>'publicar','')<>'sim' then continue;end if;
  select * into anterior from public.produtos where codigo=item->>'codigo' for update;
  if found and anterior.assinatura_carga=item->>'assinatura_carga' and anterior.arquivado_em is null and anterior.ativo and not anterior.dado_teste then
   sem_alteracao:=sem_alteracao+1;continue;
  end if;
  select id into cid from public.categorias where nome=item->>'categoria' and ativo and arquivado_em is null;
  insert into public.produtos(codigo,nome,slug,descricao,categoria_id,colecao_id,preco,preco_promocional,status_catalogo,ativo,dado_teste,lote_lancamento_id,ordem_vitrine,observacoes_curadoria,assinatura_carga,criado_por,atualizado_por)
  values(item->>'codigo',item->>'nome','peca-'||lower(item->>'codigo'),coalesce(item->>'descricao_curta',''),cid,col,(item->>'preco')::numeric,(item->>'preco_promocional')::numeric,'rascunho',false,false,p_lote,coalesce((item->>'ordem_vitrine')::integer,0),coalesce(item->>'observacoes',''),item->>'assinatura_carga',auth.uid(),auth.uid())
  on conflict(codigo) do update set nome=excluded.nome,descricao=excluded.descricao,categoria_id=excluded.categoria_id,colecao_id=excluded.colecao_id,
   preco=excluded.preco,preco_promocional=excluded.preco_promocional,status_catalogo='rascunho',ativo=false,arquivado_em=null,dado_teste=false,lote_lancamento_id=p_lote,
   ordem_vitrine=excluded.ordem_vitrine,observacoes_curadoria=excluded.observacoes_curadoria,assinatura_carga=excluded.assinatura_carga,modelo_veste=case when public.produtos.dado_teste then null else public.produtos.modelo_veste end,selo=null,atualizado_por=auth.uid()
  returning id into pid;
  vars:=coalesce(item->'variacoes',jsonb_build_array(jsonb_build_object('cor',item->>'cor','tamanho',item->>'tamanho','estoque',item->'estoque')));
  -- Retira apenas variações/medidas fictícias. Variações reais ausentes são preservadas.
  if anterior.dado_teste then
   update public.medidas_tamanho set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where produto_id=pid;
   for v in select * from public.variacoes where produto_id=pid and not exists(select 1 from jsonb_array_elements(vars) x where x->>'cor'=cor and x->>'tamanho'=tamanho) for update loop
    if v.estoque_fisico<>0 then perform public.ajustar_estoque(v.id,-v.estoque_fisico,'Substituição de variação fictícia pelo estoque oficial',p_lote);end if;
    update public.variacoes set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where id=v.id;
   end loop;
  end if;
  for variacao in select value from jsonb_array_elements(vars) loop
   select id into vid from public.variacoes where produto_id=pid and tamanho=variacao->>'tamanho' and cor=variacao->>'cor';
   if vid is null then
    insert into public.variacoes(produto_id,sku,tamanho,cor,criado_por,atualizado_por) values(pid,item->>'codigo'||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),variacao->>'tamanho',variacao->>'cor',auth.uid(),auth.uid()) returning id into vid;
   else update public.variacoes set ativo=true,arquivado_em=null,atualizado_por=auth.uid() where id=vid;end if;
   select * into v from public.variacoes where id=vid for update;
   if v.estoque_fisico<>(variacao->>'estoque')::integer then perform public.ajustar_estoque(vid,(variacao->>'estoque')::integer-v.estoque_fisico,'Carga oficial incremental de lançamento',p_lote);end if;
   total_vars:=total_vars+1;
  end loop;
  update public.midias set ativo=false,principal=false,arquivado_em=coalesce(arquivado_em,now()),atualizado_por=auth.uid() where produto_id=pid;
  for foto in select value from jsonb_array_elements(item->'fotos') loop
   insert into public.midias(produto_id,caminho_storage,tipo,alt_texto,ordem,principal,criado_por,atualizado_por)
   values(pid,foto->>'caminho','foto',item->>'nome',(foto->>'ordem')::integer,(foto->>'ordem')::integer=1,auth.uid(),auth.uid());
   total_fotos:=total_fotos+1;
  end loop;
  update public.produtos set status_catalogo='publicado',ativo=true where id=pid;
  publicadas:=publicadas+1;
 end loop;
 -- A publicação oficial encerra os fictícios, preserva peças reais não incluídas e não depende do horário.
 perform private.arquivar_dados_teste();
 resultado:=jsonb_build_object('lote',p_lote,'publicadas',publicadas,'rascunhos',0,'arquivadas',0,'fotos',total_fotos,'variacoes',total_vars,'sem_alteracao_servidor',sem_alteracao);
 insert into private.lotes_catalogo(id,manifesto,backup_referencia,assinatura_anterior,resultado,criado_por) values(p_lote,p_manifesto,p_backup,p_assinatura,resultado,auth.uid());
 return resultado;
end $$;
-- Em instalações com pg_cron (Supabase), arquivamento automático sem bloquear dados reais.
-- PGlite não tem esta extensão. A RLS e a vitrine cortam a visibilidade no instante exato.
do $cron$
begin
 if exists(select 1 from pg_catalog.pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron';
  execute $job$select cron.schedule('rosemodas-corte-testes','* * * * *',
   'DO $corte$ BEGIN IF now() >= ''2026-10-09 21:00:00+00''::timestamptz THEN PERFORM private.arquivar_dados_teste(); PERFORM cron.unschedule(''rosemodas-corte-testes''); END IF; END $corte$;')$job$;
 end if;
end $cron$;
commit;
