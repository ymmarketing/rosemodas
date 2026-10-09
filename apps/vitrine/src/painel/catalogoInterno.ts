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
  dado_teste?: boolean; id: string; codigo: string; nome: string|null; nome_sugerido?: string|null; observacoes_curadoria?: string; descricao: string; categoria_id: string|null; colecao_id: string|null;
  preco: number|null; preco_promocional: number|null; modelo_veste: string|null;
  status_catalogo: 'rascunho'|'publicado'; ativo: boolean; atualizado_em: string;
  midias: MidiaInterna[]; variacoes: VariacaoInterna[]; medidas: MedidaInterna[];
};
export type ListaInterna = { itens: PecaInterna[]; total: number; categorias: {id:string;nome:string}[]; colecoes: {id:string;nome:string}[] };
export async function operar<T>(acao: string, id: string|null = null, dados: object = {}): Promise<T> {
  const {data,error} = await clienteInterno().rpc('operar_catalogo', { p_acao: acao, p_id: id, p_dados: dados, p_correlation_id: crypto.randomUUID() });
  if (error) throw new Error(error.message);
  return data as T;
}
export function pendenciasDaPeca(p: PecaInterna) {
  const faltas: string[] = [];
  if (!p.nome?.trim()) faltas.push('nome');
  if (p.preco === null || p.preco <= 0) faltas.push('preço');
  if (!p.categoria_id) faltas.push('categoria');
  if (!p.midias.some(m=>m.ativo && m.tipo==='foto' && m.principal)) faltas.push('foto de capa');
  if (!p.variacoes.some(v=>v.ativo && v.tamanho.trim() && v.cor.trim() && v.quantidade !== '' && Number.isInteger(Number(v.quantidade)) && Number(v.quantidade)>=0)) faltas.push('variação e quantidade');
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
