-- Export lógico, somente leitura. Executar no projeto explicitamente selecionado.
-- Não inclui senhas, sessões, tokens de Auth nem chaves da infraestrutura.
select jsonb_build_object(
  'formato','rose-catalogo-v2',
  'exportado_em',now(),
  'ambiente',jsonb_build_object('uso','producao','project_ref','kernpudxhwkpoadahgqj','banco_unico',true),
  'schema_migrations',(select jsonb_agg(to_jsonb(m) order by m.version) from supabase_migrations.schema_migrations m),
  'tabelas',jsonb_build_object(
    'categorias',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.categorias t),
    'colecoes',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.colecoes t),
    'produtos',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.produtos t),
    'variacoes',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.variacoes t),
    'medidas_tamanho',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.medidas_tamanho t),
    'midias',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.midias t),
    'movimentos_estoque',(select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em,t.id),'[]'::jsonb) from public.movimentos_estoque t),
    'configuracoes',(select coalesce(jsonb_agg(to_jsonb(t) order by t.chave),'[]'::jsonb) from public.configuracoes t),
    'audit_log',(select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em,t.id),'[]'::jsonb) from public.audit_log t),
    'profiles',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id),'[]'::jsonb) from public.profiles t),
    'clientes',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.clientes t),
    'enderecos',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.enderecos t),
    'pedidos',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.pedidos t),
    'itens_pedido',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.itens_pedido t),
    'enderecos_pedido',(select coalesce(jsonb_agg(to_jsonb(t) order by t.pedido_id),'[]'::jsonb) from public.enderecos_pedido t),
    'envios',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.envios t),
    'eventos_envio',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.eventos_envio t),
    'usuarios_internos',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id),'[]'::jsonb) from public.usuarios_internos t)
  ),
  'auth_referencias',(select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'phone',u.phone) order by u.id),'[]'::jsonb)
    from auth.users u),
  'privado',jsonb_build_object(
    'lotes_catalogo',(select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em,t.id),'[]'::jsonb) from private.lotes_catalogo t),
    'conciliacoes_clientes',(select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em,t.id),'[]'::jsonb) from private.conciliacoes_clientes t)
  ),
  'storage',jsonb_build_object(
    'bucket',(select to_jsonb(b) from storage.buckets b where b.id='produtos-publico'),
    'objetos',(select coalesce(jsonb_agg(jsonb_build_object('name',o.name,'size',o.metadata->'size','mimetype',o.metadata->'mimetype','updated_at',o.updated_at) order by o.name),'[]'::jsonb)
      from storage.objects o where o.bucket_id='produtos-publico')
  ),
  'tabelas_publicas',(select jsonb_agg(tablename order by tablename) from pg_tables where schemaname='public')
) as snapshot;
