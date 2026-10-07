-- Operação de dados autorizada em 07/10/2026; somente homologação.
-- Não publica peças, não altera preços, fotos, variações ou estoque.
begin;
do $$
declare colecao uuid; quantidade integer;
begin
  if not exists (select 1 from public.configuracoes where chave='ambiente_homologacao'
    and valor->>'uso'='homologacao' and valor->>'project_ref'='kernpudxhwkpoadahgqj') then
    raise exception 'Operação permitida somente na homologação da Rose Modas.';
  end if;
  select id into colecao from public.colecoes where atual and ativo and arquivado_em is null;
  if colecao is null then raise exception 'Nenhuma coleção atual ativa configurada.'; end if;
  perform set_config('app.correlation_id',gen_random_uuid()::text,true);
  update public.produtos set colecao_id=colecao
    where status_catalogo='rascunho' and not ativo and arquivado_em is null
      and colecao_id is null and codigo ~ '^RM-C0(0[1-9]|1[0-8])$';
  get diagnostics quantidade = row_count;
  raise notice 'Coleção atual aplicada a % rascunho(s); publicação e dados comerciais preservados.',quantidade;
end $$;
select count(*) as rascunhos_na_colecao_atual from public.produtos p join public.colecoes c on c.id=p.colecao_id
  where c.atual and c.ativo and c.arquivado_em is null and p.status_catalogo='rascunho' and not p.ativo
    and p.arquivado_em is null and p.codigo ~ '^RM-C0(0[1-9]|1[0-8])$';
commit;
