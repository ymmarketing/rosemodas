-- Consulta de compras solicitada junto da autenticação. Estrutura da V2 com uso real.
-- Sem carrinho, checkout, cobranças, reservas, CRM, ERP ou integrações externas.
begin;
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  nome text not null default 'Cliente' check(length(btrim(nome))>0),
  cpf text check(cpf ~ '^[0-9]{11}$'),
  email_normalizado text check(email_normalizado=lower(btrim(email_normalizado)) and position('@' in email_normalizado)>1),
  whatsapp_normalizado text check(whatsapp_normalizado ~ '^\+[1-9][0-9]{7,14}$'),
  data_nascimento date, tamanho_preferido text, cidade text, uf text check(uf ~ '^[A-Z]{2}$'),
  lifecycle_status text not null default 'lead' check(lifecycle_status in ('lead','ativa','em_risco','inativa')),
  primeira_origem text, ultima_origem text,
  mesclado_em_cliente_id uuid references public.clientes(id) on delete restrict, mesclado_em timestamptz,
  ativo boolean not null default true, arquivado_em timestamptz,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict, atualizado_por uuid references auth.users(id) on delete restrict,
  check(arquivado_em is null or not ativo),
  check((mesclado_em_cliente_id is null)=(mesclado_em is null)), check(mesclado_em_cliente_id is null or mesclado_em_cliente_id<>id)
);
create unique index clientes_cpf_canonico_idx on public.clientes(cpf) where mesclado_em_cliente_id is null;
create unique index clientes_email_canonico_idx on public.clientes(email_normalizado) where mesclado_em_cliente_id is null;
create index clientes_whatsapp_idx on public.clientes(whatsapp_normalizado);
create index clientes_lifecycle_idx on public.clientes(lifecycle_status);
create index clientes_mesclado_idx on public.clientes(mesclado_em_cliente_id);

create table public.enderecos (
  id uuid primary key default gen_random_uuid(), cliente_id uuid not null references public.clientes(id) on delete restrict,
  apelido text, nome_destinatario text not null, cep text not null check(cep ~ '^[0-9]{8}$'),
  rua text not null, numero text not null, complemento text, bairro text not null, cidade text not null, uf text not null check(uf ~ '^[A-Z]{2}$'),
  principal boolean not null default false, ativo boolean not null default true, arquivado_em timestamptz,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict, atualizado_por uuid references auth.users(id) on delete restrict,
  check(arquivado_em is null or not ativo)
);
create index enderecos_cliente_idx on public.enderecos(cliente_id);
create unique index enderecos_principal_idx on public.enderecos(cliente_id) where principal and ativo and arquivado_em is null;

create table public.pedidos (
  id uuid primary key default gen_random_uuid(), numero text not null unique check(length(btrim(numero))>0),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  canal text not null check(canal in ('site','live','whatsapp','painel','manychat')),
  status_pedido text not null default 'aberto' check(status_pedido in ('aberto','confirmado','em_processamento','concluido','cancelado')),
  status_pagamento text not null default 'pendente' check(status_pagamento in ('pendente','confirmado','recebido','parcialmente_estornado','estornado')),
  status_fulfillment text not null default 'aguardando_separacao' check(status_fulfillment in ('aguardando_separacao','em_separacao','separado','aguardando_postagem','postado')),
  status_envio text not null default 'aguardando' check(status_envio in ('aguardando','postado','em_transito','saiu_para_entrega','entregue','devolvido','extraviado')),
  subtotal numeric(12,2) not null default 0 check(subtotal>=0 and subtotal< 'Infinity'::numeric),
  desconto numeric(12,2) not null default 0 check(desconto>=0 and desconto<=subtotal),
  frete_cobrado numeric(12,2) not null default 0 check(frete_cobrado>=0 and frete_cobrado< 'Infinity'::numeric),
  total numeric(12,2) not null default 0 check(total>=0 and total=subtotal-desconto+frete_cobrado),
  utm_source text,utm_medium text,utm_campaign text,utm_content text,utm_term text,referrer text,observacoes text,
  correlation_id uuid not null default gen_random_uuid() unique,
  confirmado_em timestamptz,cancelado_em timestamptz,motivo_cancelamento text,concluido_em timestamptz,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict, atualizado_por uuid references auth.users(id) on delete restrict
);
create index pedidos_cliente_criado_idx on public.pedidos(cliente_id,criado_em desc);
create index pedidos_status_idx on public.pedidos(status_pedido,status_pagamento,status_envio);

create table public.itens_pedido (
  id uuid primary key default gen_random_uuid(),pedido_id uuid not null references public.pedidos(id) on delete restrict,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  variacao_id uuid not null,sku_snapshot text not null,nome_snapshot text not null,cor_snapshot text not null,tamanho_snapshot text not null,
  preco_unitario numeric(12,2) not null check(preco_unitario>=0 and preco_unitario< 'Infinity'::numeric),
  custo_unitario_snapshot numeric(12,2) not null default 0 check(custo_unitario_snapshot>=0 and custo_unitario_snapshot< 'Infinity'::numeric),
  quantidade integer not null check(quantidade>0),desconto_item numeric(12,2) not null default 0 check(desconto_item>=0),
  total_item numeric(12,2) not null check(total_item>=0 and total_item=preco_unitario*quantidade-desconto_item),
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict, atualizado_por uuid references auth.users(id) on delete restrict,
  foreign key(variacao_id,produto_id) references public.variacoes(id,produto_id) on delete restrict
);
create index itens_pedido_pedido_idx on public.itens_pedido(pedido_id);
create index itens_pedido_variacao_idx on public.itens_pedido(variacao_id);

create table public.enderecos_pedido (
  pedido_id uuid primary key references public.pedidos(id) on delete restrict,
  nome_destinatario text not null,telefone text,cep text not null check(cep ~ '^[0-9]{8}$'),rua text not null,numero text not null,
  complemento text,bairro text not null,cidade text not null,uf text not null check(uf ~ '^[A-Z]{2}$'),
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict, atualizado_por uuid references auth.users(id) on delete restrict
);
create table public.envios (
  id uuid primary key default gen_random_uuid(),pedido_id uuid not null references public.pedidos(id) on delete restrict,
  tipo text not null check(tipo in ('saida','reversa','reenvio')),servico text not null check(servico in ('pac','sedex')),
  codigo_servico text,peso_total_g integer check(peso_total_g>0),
  valor_cotado numeric(12,2) check(valor_cotado>=0 and valor_cotado< 'Infinity'::numeric),
  valor_pago_correios numeric(12,2) check(valor_pago_correios>=0 and valor_pago_correios< 'Infinity'::numeric),
  prazo_dias integer check(prazo_dias>=0),codigo_rastreio text,
  status text not null default 'aguardando' check(status in ('aguardando','postado','em_transito','saiu_para_entrega','entregue','devolvido','extraviado')),
  postado_em timestamptz,entregue_em timestamptz,ultima_consulta_em timestamptz,proxima_consulta_em timestamptz,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict, atualizado_por uuid references auth.users(id) on delete restrict
);
create unique index envios_codigo_rastreio_idx on public.envios(codigo_rastreio) where codigo_rastreio is not null;
create index envios_pedido_idx on public.envios(pedido_id);
create index envios_status_consulta_idx on public.envios(status,proxima_consulta_em);
create table public.eventos_envio (
  id uuid primary key default gen_random_uuid(),envio_id uuid not null references public.envios(id) on delete restrict,
  codigo text not null,descricao text not null,cidade text,uf text check(uf ~ '^[A-Z]{2}$'),data_evento timestamptz not null,
  criado_em timestamptz not null default now(),unique(envio_id,codigo,data_evento)
);
create index eventos_envio_envio_data_idx on public.eventos_envio(envio_id,data_evento desc);

create function private.cliente_atual_id() returns uuid language sql stable security definer set search_path='' as $$
 select c.id from public.clientes c join public.profiles p on p.user_id=c.auth_user_id
 where c.auth_user_id=auth.uid() and p.ativo and c.ativo and c.arquivado_em is null and c.mesclado_em_cliente_id is null
   and coalesce(auth.jwt()->>'is_anonymous','false')<>'true';
$$;
revoke all on function private.cliente_atual_id() from public,anon,authenticated,service_role;
grant execute on function private.cliente_atual_id() to authenticated;

do $$ declare t text;begin
  foreach t in array array['clientes','enderecos','pedidos','itens_pedido','enderecos_pedido','envios','eventos_envio'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('create trigger impedir_exclusao before delete on public.%I for each row execute function private.bloquear_exclusao()',t);
    execute format('create trigger impedir_truncate before truncate on public.%I for each statement execute function private.bloquear_exclusao()',t);
    if t<>'eventos_envio' then
      execute format('create trigger atualizar_timestamp before update on public.%I for each row execute function private.atualizar_timestamp()',t);
    end if;
    execute format('create trigger registrar_auditoria after insert%s on public.%I for each row execute function private.registrar_auditoria()',case when t='eventos_envio' then '' else ' or update' end,t);
  end loop;
end $$;
create trigger impedir_mutacao before update on public.eventos_envio for each row execute function private.bloquear_mutacao_historico();
create policy clientes_leitura on public.clientes for select to authenticated using(id=(select private.cliente_atual_id()) or (select private.e_admin()));
create policy enderecos_leitura on public.enderecos for select to authenticated using(cliente_id=(select private.cliente_atual_id()) or (select private.e_admin()));
create policy pedidos_leitura on public.pedidos for select to authenticated using(cliente_id=(select private.cliente_atual_id()) or (select private.e_admin()));
create policy itens_pedido_leitura on public.itens_pedido for select to authenticated using(exists(select 1 from public.pedidos p where p.id=pedido_id));
create policy enderecos_pedido_leitura on public.enderecos_pedido for select to authenticated using(exists(select 1 from public.pedidos p where p.id=pedido_id));
create policy envios_leitura on public.envios for select to authenticated using(exists(select 1 from public.pedidos p where p.id=pedido_id));
create policy eventos_envio_leitura on public.eventos_envio for select to authenticated using(exists(select 1 from public.envios e where e.id=envio_id));
-- Lista explícita de colunas: custo, observações internas, dados de aquisição e frete pago não são expostos.
grant select(id,nome,email_normalizado,whatsapp_normalizado,tamanho_preferido,cidade,uf,ativo) on public.clientes to authenticated;
grant select(id,cliente_id,apelido,nome_destinatario,cep,rua,numero,complemento,bairro,cidade,uf,principal,ativo) on public.enderecos to authenticated;
grant select(id,numero,cliente_id,canal,status_pedido,status_pagamento,status_fulfillment,status_envio,subtotal,desconto,frete_cobrado,total,criado_em) on public.pedidos to authenticated;
grant select(id,pedido_id,produto_id,variacao_id,sku_snapshot,nome_snapshot,cor_snapshot,tamanho_snapshot,preco_unitario,quantidade,desconto_item,total_item) on public.itens_pedido to authenticated;
grant select(pedido_id,nome_destinatario,telefone,cep,rua,numero,complemento,bairro,cidade,uf) on public.enderecos_pedido to authenticated;
grant select(id,pedido_id,tipo,servico,codigo_rastreio,status,postado_em,entregue_em) on public.envios to authenticated;
grant select(id,envio_id,codigo,descricao,cidade,uf,data_evento) on public.eventos_envio to authenticated;

create function private.criar_cliente_auth() returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Vínculo exclusivamente por auth.uid. Nunca vincula compras antigas pelo e-mail não confirmado.
  insert into public.clientes(auth_user_id,email_normalizado) values(new.id,lower(btrim(new.email)));
  return new;
end $$;
create trigger zz_criar_cliente after insert on auth.users for each row execute function private.criar_cliente_auth();
revoke all on function private.criar_cliente_auth() from public,anon,authenticated,service_role;
insert into public.clientes(auth_user_id,email_normalizado)
select a.id,lower(btrim(a.email)) from auth.users a join public.profiles p on p.user_id=a.id where p.role='cliente';
commit;
