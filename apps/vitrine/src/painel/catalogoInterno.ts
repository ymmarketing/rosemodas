import { clienteAutenticado } from '../auth/acesso.ts';

export const painelUrl = '/painel';
export function entradaInterna(host: string, path: string) {
  return host === 'rosemodas-painel-homologacao.vercel.app'
    || host === 'painel-homolog.rosemenezesmodas.com.br'
    || path==='/painel' || path.startsWith('/painel/');
}
export function clienteInterno() {
  return clienteAutenticado('equipe');
}
export type MidiaInterna = { id: string; caminho_storage: string; tipo: 'foto'|'video'; alt_texto: string; principal: boolean; ativo: boolean; ordem: number };
export type VariacaoInterna = { id: string; sku: string; tamanho: string; cor: string; quantidade: number|string; ativo: boolean };
export type MedidaInterna = { id: string; tamanho: string; medida: string; rotulo: string; valor_cm: number|string; ativo: boolean };
export type PecaInterna = {
  peso_g?:number|null; largura_dobrada_cm?:number|null; altura_dobrada_cm?:number|null; comprimento_dobrado_cm?:number|null; dado_teste?: boolean; id: string; codigo: string; nome: string|null; nome_sugerido?: string|null; observacoes_curadoria?: string; descricao: string; categoria_id: string|null; colecao_id: string|null;
  preco: number|null; preco_promocional: number|null; modelo_veste: string|null;
  status_catalogo: 'rascunho'|'publicado'; ativo: boolean; atualizado_em: string;
  midias: MidiaInterna[]; variacoes: VariacaoInterna[]; medidas: MedidaInterna[];
};
export type ListaInterna = { itens: PecaInterna[]; total: number; categorias: {id:string;nome:string;embalagem_padrao?:Record<string,string>}[]; colecoes: {id:string;nome:string}[] };
export function embalagemEfetiva(p: Pick<PecaInterna,'peso_g'|'largura_dobrada_cm'|'altura_dobrada_cm'|'comprimento_dobrado_cm'>, padrao: Record<string,string> = {}) {
  const usar=(proprio:number|null|undefined,chave:string)=>proprio??(padrao[chave]?Number(padrao[chave]):null);
  return {peso_g:usar(p.peso_g,'peso_g'),largura_cm:usar(p.largura_dobrada_cm,'largura_cm'),altura_cm:usar(p.altura_dobrada_cm,'altura_cm'),comprimento_cm:usar(p.comprimento_dobrado_cm,'comprimento_cm')};
}
export async function operar<T>(acao: string, id: string|null = null, dados: object = {}): Promise<T> {
  const {data,error} = await clienteInterno().rpc('operar_catalogo', { p_acao: acao, p_id: id, p_dados: dados, p_correlation_id: crypto.randomUUID() });
  if (error) throw new Error(error.message);
  return data as T;
}
export function pendenciasDaPeca(p: PecaInterna) {
  const faltas: string[] = [];
  if (!p.nome?.trim()) faltas.push('nome');
  if (p.preco === null || p.preco <= 0) faltas.push('preço');
  if (!p.midias.some(m=>m.ativo && m.tipo==='foto')) faltas.push('foto');
  return faltas;
}
export function prepararUpload(arquivo: Pick<File,'type'|'size'>, produtoId: string, id: string) {
  const extensoes: Record<string,string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
  const ext = extensoes[arquivo.type];
  if (!ext) throw new Error('Use fotos JPG, PNG ou WebP e vídeos MP4 ou WebM.');
  if (arquivo.size > 50*1024*1024 || arquivo.size === 0) throw new Error('Cada arquivo deve ter até 50 MB e não pode estar vazio.');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!uuid.test(produtoId) || !uuid.test(id)) throw new Error('Identificação de arquivo inválida.');
  return { caminho: `${produtoId}/${id}.${ext}`, tipo: arquivo.type.startsWith('image/') ? 'foto' : 'video' };
}
export async function enviarMidia(p: PecaInterna, arquivo: File) {
  const id = crypto.randomUUID(), { caminho, tipo } = prepararUpload(arquivo,p.id,id);
  const {error} = await clienteInterno().storage.from('produtos-publico').upload(caminho,arquivo,{upsert:false,contentType:arquivo.type});
  if (error) throw new Error(`Não foi possível enviar ${arquivo.name}: ${error.message}`);
  return operar<PecaInterna>('midia_adicionar',p.id,{id,caminho_storage:caminho,tipo,alt_texto:p.nome??`Peça ${p.codigo}`});
}
