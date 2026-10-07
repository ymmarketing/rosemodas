-- Construção: bloco 1 autorizado em 07/10/2026. Mantém constraints e autorização existentes.
-- Coleção atual para novos rascunhos e validação amigável antes da escrita.
begin;

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
    from (select id from public.produtos where arquivado_em is null
      and (coalesce(p_dados->>'status','')='' or status_catalogo=p_dados->>'status')
      and (coalesce(p_dados->>'busca','')='' or coalesce(nome,'')||' '||codigo ilike '%'||(p_dados->>'busca')||'%')
      order by criado_em desc,id limit 48 offset pagina*48) x;
    return resultado || jsonb_build_object(
      'total',(select count(*) from public.produtos where arquivado_em is null
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
