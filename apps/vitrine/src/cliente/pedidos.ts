import type { SupabaseClient } from '@supabase/supabase-js';
export type Pedido = {id:string;numero:string;cliente_id:string;canal:string;status_pedido:string;status_pagamento:string;status_fulfillment:string;status_envio:string;subtotal:number;desconto:number;frete_cobrado:number;total:number;criado_em:string};
export type ItemPedido = {id:string;pedido_id:string;nome_snapshot:string;sku_snapshot:string;cor_snapshot:string;tamanho_snapshot:string;quantidade:number;preco_unitario:number;total_item:number};
export type EnderecoPedido = {pedido_id:string;nome_destinatario:string;cep:string;rua:string;numero:string;complemento:string|null;bairro:string;cidade:string;uf:string};
export type Envio = {id:string;pedido_id:string;servico:string;codigo_rastreio:string|null;status:string;postado_em:string|null;entregue_em:string|null};
export type EventoEnvio = {id:string;envio_id:string;descricao:string;cidade:string|null;uf:string|null;data_evento:string};
export type DetalhesPedido = {itens:ItemPedido[];endereco:EnderecoPedido|null;envios:Envio[];eventos:EventoEnvio[]};
export async function consultarPedidos(sb:SupabaseClient):Promise<Pedido[]> {
  const {data,error}=await sb.from('pedidos').select('id,numero,cliente_id,canal,status_pedido,status_pagamento,status_fulfillment,status_envio,subtotal,desconto,frete_cobrado,total,criado_em').order('criado_em',{ascending:false});
  if(error)throw new Error('Não foi possível carregar os pedidos. Tente novamente.');
  return data??[];
}
export async function consultarDetalhes(sb:SupabaseClient,id:string):Promise<DetalhesPedido> {
  const [itens,endereco,envios]=await Promise.all([
    sb.from('itens_pedido').select('id,pedido_id,nome_snapshot,sku_snapshot,cor_snapshot,tamanho_snapshot,quantidade,preco_unitario,total_item').eq('pedido_id',id),
    sb.from('enderecos_pedido').select('pedido_id,nome_destinatario,cep,rua,numero,complemento,bairro,cidade,uf').eq('pedido_id',id).maybeSingle(),
    sb.from('envios').select('id,pedido_id,servico,codigo_rastreio,status,postado_em,entregue_em').eq('pedido_id',id),
  ]);
  if(itens.error||endereco.error||envios.error)throw new Error('Não foi possível carregar os detalhes. Tente novamente.');
  let eventos:EventoEnvio[]=[];
  if(envios.data?.length){const r=await sb.from('eventos_envio').select('id,envio_id,descricao,cidade,uf,data_evento').in('envio_id',envios.data.map(e=>e.id)).order('data_evento',{ascending:false});if(r.error)throw new Error('Não foi possível carregar o rastreio. Tente novamente.');eventos=r.data??[];}
  return {itens:itens.data??[],endereco:endereco.data,envios:envios.data??[],eventos};
}
const rotulos:Record<string,string>={aberto:'Pedido recebido',confirmado:'Confirmado',em_processamento:'Em processamento',concluido:'Concluído',cancelado:'Cancelado',pendente:'Pendente',recebido:'Recebido',parcialmente_estornado:'Parcialmente estornado',estornado:'Estornado',aguardando_separacao:'Aguardando separação',em_separacao:'Em separação',separado:'Separado',aguardando_postagem:'Aguardando postagem',aguardando:'Aguardando envio',postado:'Postado',em_transito:'Em trânsito',saiu_para_entrega:'Saiu para entrega',entregue:'Entregue',devolvido:'Devolvido',extraviado:'Extraviado'};
export const rotuloStatus=(s:string)=>rotulos[s]??s;
