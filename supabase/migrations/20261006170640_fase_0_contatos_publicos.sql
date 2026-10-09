-- Construção da Fase 0: somente contatos comerciais públicos da vitrine.
-- A migration da fundação permanece imutável. Nenhuma nova tabela ou FK.
alter policy configuracoes_publicas on public.configuracoes using (
  chave in ('nome_loja', 'descricao_loja', 'logo_caminho', 'whatsapp_numero', 'instagram_url')
);
