-- Dados fictícios autorizados em 08/10/2026. Nunca são o estoque oficial.
-- Esta migration preserva fotos e histórico. Efeito apenas nos 18 códigos identificados.
begin;
create function private.preparar_catalogo_teste_lancamento() returns integer language plpgsql set search_path='' as $func$
declare itens jsonb := $lista$[{"codigo": "RM-C001", "nome": "Vestido floral amarelo de alças"}, {"codigo": "RM-C002", "nome": "Vestido claro sem mangas"}, {"codigo": "RM-C003", "nome": "Conjunto claro com botões"}, {"codigo": "RM-C004", "nome": "Vestido floral azul com babado"}, {"codigo": "RM-C005", "nome": "Vestido floral vermelho de decote V"}, {"codigo": "RM-C006", "nome": "Vestido floral azul de decote reto"}, {"codigo": "RM-C007", "nome": "Vestido floral vermelho de decote reto"}, {"codigo": "RM-C008", "nome": "Vestido floral de alças com cintura marcada"}, {"codigo": "RM-C009", "nome": "Conjunto de poá preto e branco"}, {"codigo": "RM-C010", "nome": "Macacão verde com faixa"}, {"codigo": "RM-C011", "nome": "Conjunto listrado laranja e branco"}, {"codigo": "RM-C012", "nome": "Blusa sem mangas floral laranja"}, {"codigo": "RM-C013", "nome": "Blusa preta sem mangas"}, {"codigo": "RM-C014", "nome": "Blusa azul com estampa abstrata"}, {"codigo": "RM-C015", "nome": "Blusa azul com flores claras"}, {"codigo": "RM-C016", "nome": "Blusa verde com estampa abstrata"}, {"codigo": "RM-C017", "nome": "Blusa vinho sem mangas"}, {"codigo": "RM-C018", "nome": "Blusa verde-azulada sem mangas"}]$lista$::jsonb;item jsonb;pid uuid;vid uuid;v public.variacoes;cid uuid;i integer:=0;
begin
 -- Banco limpo/CI não recebe dados reais nem busca fotos na internet.
 if (select count(*) from public.produtos p join jsonb_array_elements(itens) x on p.codigo=x->>'codigo')<>18 then return 0;end if;
 if not private.teste_visivel() or exists(select 1 from private.lotes_catalogo) then return 0;end if;
 if (select count(*) from public.categorias where nome in('Vestidos','Blusas','Conjuntos','Calças e saias','Kimonos') and ativo and arquivado_em is null)<>5 then raise exception 'Categorias de teste não disponíveis.';end if;
 if exists(select 1 from jsonb_array_elements(itens) x where not exists(select 1 from public.midias m join storage.objects o on o.name=m.caminho_storage and o.bucket_id='produtos-publico' where m.produto_id=(select id from public.produtos where codigo=x->>'codigo') and m.principal and m.tipo='foto' and m.ativo and m.arquivado_em is null)) then raise exception 'As fotos atuais precisam ser preservadas e ter capa em todas as 18 peças.';end if;
 perform set_config('app.correlation_id','20261008-0000-4000-8000-000000000018',true);
 -- Limpeza dos três pontos confirmada: 12 exemplos; coleção compartilhada; RM-C011.
 update public.produtos set dado_teste=true,ativo=false,status_catalogo='rascunho',arquivado_em=coalesce(arquivado_em,now()) where codigo like 'HOM-RM%' or codigo='SMOKE-01';
 update public.variacoes vv set ativo=false,arquivado_em=coalesce(vv.arquivado_em,now()) from public.produtos p where p.id=vv.produto_id and (p.codigo like 'HOM-RM%' or p.codigo='SMOKE-01');
 update public.medidas_tamanho m set ativo=false,arquivado_em=coalesce(m.arquivado_em,now()) from public.produtos p where p.id=m.produto_id and (p.codigo like 'HOM-RM%' or p.codigo='SMOKE-01');
 update public.colecoes set nome='Coleção de lançamento',dado_teste=false where atual and ativo and arquivado_em is null;
 for item in select value from jsonb_array_elements(itens) loop
  select id into pid from public.produtos where codigo=item->>'codigo';i:=i+1;
  select id into cid from public.categorias where nome=case when i>=12 then 'Blusas' when i in(3,9,10,11) then 'Conjuntos' else 'Vestidos' end and ativo and arquivado_em is null;
  update public.produtos set dado_teste=true,nome='[TESTE] '||(item->>'nome'),descricao='Dados fictícios para validação. Fotos atuais serão renovadas para o lançamento.',
    observacoes_curadoria='Teste controlado até 09/10/2026 às 18h BRT. Nome sugerido, preço, cor, tamanho e estoque são fictícios.',
    preco=100+i,preco_promocional=null,categoria_id=cid,colecao_id=(select id from public.colecoes where atual and ativo and arquivado_em is null),
    ativo=true,status_catalogo='publicado',arquivado_em=null,modelo_veste=null,selo=null,ordem_vitrine=i where id=pid;
  select id into vid from public.variacoes where produto_id=pid and tamanho='48' and cor='Demonstração';
  for v in select * from public.variacoes where produto_id=pid and id is distinct from vid loop
   if v.estoque_fisico<>0 then perform public.ajustar_estoque(v.id,-v.estoque_fisico,'Encerrar saldo anterior de teste','20261008-0000-4000-8000-000000000018');end if;
   update public.variacoes set ativo=false,arquivado_em=coalesce(arquivado_em,now()) where id=v.id;
  end loop;
  if vid is null then insert into public.variacoes(produto_id,sku,tamanho,cor) values(pid,(item->>'codigo')||'-DEMO-LANCAMENTO','48','Demonstração') returning id into vid;end if;
  update public.variacoes set ativo=true,arquivado_em=null where id=vid;
  select * into v from public.variacoes where id=vid for update;
  if v.estoque_fisico<>1 then perform public.ajustar_estoque(vid,1-v.estoque_fisico,'Saldo fictício autorizado para testes de lançamento','20261008-0000-4000-8000-000000000018');end if;
 end loop;
 return i;
end $func$;
revoke all on function private.preparar_catalogo_teste_lancamento() from public,anon,authenticated,service_role;
select private.preparar_catalogo_teste_lancamento();
-- Inutiliza o marcador que autorizava seeds antigos no banco hospedado.
update public.configuracoes set valor=valor||'{"uso":"producao","banco_unico":true}'::jsonb where chave='ambiente_homologacao' and valor->>'project_ref'='kernpudxhwkpoadahgqj';
commit;
