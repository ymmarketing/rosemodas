-- Mantém cadastro incompleto escondido depois do corte. Liberar somente após smoke/aprovação.
begin;
alter policy configuracoes_publicas on public.configuracoes using (
 chave in ('nome_loja','descricao_loja','logo_caminho','whatsapp_numero','instagram_url','cadastro_cliente_liberado')
);
insert into public.configuracoes(chave,valor,descricao) values('cadastro_cliente_liberado','false','Após 09/10 às 18h BRT, liberar somente após smoke hospedado e aprovação; não muda as configurações do Auth.') on conflict(chave) do nothing;
commit;
