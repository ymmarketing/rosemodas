-- Distingue conexão administrativa de uma sessão Auth, sem impersonar administradora.
begin;
alter table private.lotes_catalogo alter column criado_por drop not null;
alter table private.lotes_catalogo add column operador_banco text;
alter table private.lotes_catalogo add constraint lote_autoria_identificada check(criado_por is not null or coalesce(operador_banco in ('postgres','supabase_admin'),false));
create or replace function public.aplicar_carga_oficial(p_lote uuid,p_manifesto jsonb,p_assinatura text,p_backup text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;foto jsonb;variacao jsonb;vars jsonb;pid uuid;vid uuid;cid uuid;col uuid;v public.variacoes;anterior public.produtos;
 publicadas integer:=0;rascunhos integer:=0;sem_alteracao integer:=0;total_fotos integer:=0;total_vars integer:=0;resultado jsonb;
begin
 if not private.e_admin() and not (session_user in ('postgres','supabase_admin') and coalesce(current_setting('role',true),'none') in ('none','postgres','supabase_admin')) then raise exception 'Somente admin por senha.' using errcode='42501';end if;
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
  if coalesce(item->>'publicar','') not in ('sim','não') then raise exception 'Publicação inválida na peça %.',item->>'codigo' using errcode='22023';end if;
  if coalesce(item->>'codigo','') !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' or item->>'codigo'='SMOKE-01' or item->>'codigo' like 'HOM-%'
   or nullif(btrim(item->>'nome'),'') is null or coalesce(item->>'preco','') !~ '^\d+(\.\d{1,2})?$'
   or (item->>'preco')::numeric<=0 or (item->>'preco')::numeric>9999999999.99
   or ((item->>'preco_promocional') is not null and ((item->>'preco_promocional')::numeric<0 or (item->>'preco_promocional')::numeric>=(item->>'preco')::numeric))
   or (nullif(btrim(item->>'categoria'),'') is not null and item->>'categoria'<>'Macacões' and not exists(select 1 from public.categorias where nome=item->>'categoria' and ativo and arquivado_em is null))
   or jsonb_typeof(item->'fotos') is distinct from 'array'
   or (item->>'publicar'='sim' and not exists(select 1 from jsonb_array_elements(item->'fotos') f where(f->>'ordem')::integer=1))
   or (item->>'assinatura_carga' is not null and item->>'assinatura_carga' !~ '^[a-f0-9]{64}$')
   then raise exception 'Dados inválidos na peça %.',item->>'codigo' using errcode='22023';end if;
  vars:=coalesce(item->'variacoes',jsonb_build_array(jsonb_build_object('cor',item->>'cor','tamanho',item->>'tamanho','estoque',item->'estoque')));
  if jsonb_typeof(vars) is distinct from 'array' or jsonb_array_length(vars)=0 then raise exception 'Informe variações para %.',item->>'codigo' using errcode='22023';end if;
  if(select count(distinct jsonb_build_array(x->>'cor',x->>'tamanho')) from jsonb_array_elements(vars) x)<>jsonb_array_length(vars) then raise exception 'Combinação código + cor + tamanho duplicada em %.',item->>'codigo' using errcode='22023';end if;
  for variacao in select value from jsonb_array_elements(vars) loop
   if coalesce(variacao->>'estoque','') !~ '^\d+$' or (variacao->>'estoque')::numeric>2147483647 then raise exception 'Variação inválida em %.',item->>'codigo' using errcode='22023';end if;
  end loop;
  for foto in select value from jsonb_array_elements(item->'fotos') loop
   if coalesce(foto->>'caminho','') !~ ('^lancamento/'||p_lote::text||'/'||(item->>'codigo')||'/[0-9]+\.webp$')
    or not exists(select 1 from storage.objects where bucket_id='produtos-publico' and name=foto->>'caminho') then raise exception 'Foto não preparada: %.',foto->>'caminho' using errcode='22023';end if;
  end loop;
 end loop;
 perform set_config('app.correlation_id',p_lote::text,true);
 if exists(select 1 from jsonb_array_elements(p_manifesto) x where x->>'categoria'='Macacões') and not exists(select 1 from public.categorias where nome='Macacões' and ativo and arquivado_em is null) then
  insert into public.categorias(nome,slug,ordem) values('Macacões','macacoes',40);
 end if;
 select id into col from public.colecoes where atual and arquivado_em is null limit 1;
 if col is null then insert into public.colecoes(nome,slug,atual) values('Coleção de lançamento','lancamento',true) returning id into col;
 else update public.colecoes set nome='Coleção de lançamento',slug='lancamento',dado_teste=false,ativo=true,arquivado_em=null where id=col;end if;
 for item in select value from jsonb_array_elements(p_manifesto) loop
  if coalesce(item->>'publicar','') not in ('sim','não') then raise exception 'Publicação inválida na peça %.',item->>'codigo' using errcode='22023';end if;
  select * into anterior from public.produtos where codigo=item->>'codigo' for update;
  if found and anterior.assinatura_carga=item->>'assinatura_carga' and anterior.arquivado_em is null and anterior.ativo=(item->>'publicar'='sim') and anterior.status_catalogo=(case when item->>'publicar'='sim' then 'publicado' else 'rascunho' end) and not anterior.dado_teste then
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
  update public.produtos set status_catalogo=case when item->>'publicar'='sim' then 'publicado' else 'rascunho' end,ativo=item->>'publicar'='sim' where id=pid;
  if item->>'publicar'='sim' then publicadas:=publicadas+1;else rascunhos:=rascunhos+1;end if;
 end loop;
 -- A publicação oficial encerra os fictícios, preserva peças reais não incluídas e não depende do horário.
 perform private.arquivar_dados_teste();
 resultado:=jsonb_build_object('lote',p_lote,'publicadas',publicadas,'rascunhos',rascunhos,'arquivadas',0,'fotos',total_fotos,'variacoes',total_vars,'sem_alteracao_servidor',sem_alteracao);
 insert into private.lotes_catalogo(id,manifesto,backup_referencia,assinatura_anterior,resultado,criado_por,operador_banco) values(p_lote,p_manifesto,p_backup,p_assinatura,resultado,auth.uid(),case when auth.uid() is null then session_user else null end);
 return resultado;
end $$;



commit;
