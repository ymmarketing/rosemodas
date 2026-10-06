import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscaDosFiltros, filtrosIniciais, fotoPrincipal, lerFiltros, precoAtual,
  selecionarProdutos, tamanhosDoProduto } from '../apps/vitrine/src/catalogo.ts';

const produto = (id, alteracao = {}) => ({ id, codigo: id, nome: id, slug: id, categoria_id: 'vestidos',
  colecao_id: 'atual', preco: 100, preco_promocional: null, selo: null, midias: [], ...alteracao });
const saldo = (produto_id, tamanho, cor, disponivel) => ({ variacao_id: `${produto_id}-${tamanho}-${cor}`, produto_id, tamanho, cor, disponivel });
const catalogo = {
  categorias: [{ id: 'vestidos', nome: 'Vestidos', slug: 'vestidos', ordem: 0 }, { id: 'blusas', nome: 'Blusas', slug: 'blusas', ordem: 1 }],
  colecoes: [{ id: 'atual', nome: 'Atual', slug: 'atual', atual: true }, { id: 'outra', nome: 'Outra', slug: 'outra', atual: false }],
  produtos: [produto('Aurora'), produto('Lis', { categoria_id: 'blusas', preco: 80 }),
    produto('Serena', { preco: 200, preco_promocional: 60, selo: 'novidade' }), produto('Jasmim'),
    produto('Antiga', { colecao_id: 'outra', preco: 50 })],
  saldos: [saldo('Aurora', '48', 'Rosê', 0), saldo('Aurora', '48', 'Preto', 2), saldo('Aurora', '50', 'Rosê', 0),
    saldo('Lis', '50', 'Off-white', 1), saldo('Serena', '48', 'Nude', 3), saldo('Jasmim', '48', 'Verde', 0), saldo('Antiga', '48', 'Nude', 1)],
  nomeLoja: 'Homologação', descricaoLoja: '', logoUrl: null,
};
const ids = filtros => selecionarProdutos(catalogo, { ...filtrosIniciais, ...filtros }).map(p => p.id);
test('a coleção atual é padrão; todas e outras coleções podem ser selecionadas', () => {
  assert.deepEqual(ids({}), ['Serena', 'Aurora', 'Jasmim', 'Lis']);
  assert.equal(ids({ colecao: '' }).length, 5);
  assert.deepEqual(ids({ colecao: 'outra' }), ['Antiga']);
  assert.deepEqual(ids({ colecao: 'inexistente' }), []);
});
test('categoria, tamanho e disponibilidade combinam sem usar estoque de outro produto', () => {
  assert.deepEqual(ids({ categoria: 'vestidos', tamanho: '48', disponiveis: true }), ['Serena', 'Aurora']);
  assert.deepEqual(ids({ categoria: 'vestidos', tamanho: '50' }), []);
  assert.deepEqual(ids({ categoria: 'blusas', tamanho: '50' }), ['Lis']);
  assert.deepEqual(ids({ categoria: 'inexistente' }), []);
});
test('tamanho permanece disponível quando outra cor tem saldo; estoque zero fica indisponível', () => {
  assert.deepEqual(tamanhosDoProduto(catalogo.saldos, 'Aurora'), [{ tamanho: '48', disponivel: 2 }, { tamanho: '50', disponivel: 0 }]);
  assert.ok(ids({ disponiveis: true }).includes('Aurora'));
  assert.ok(!ids({ disponiveis: true }).includes('Jasmim'));
});
test('preço promocional governa ordenação; promoção de zero não usa falsamente preço cheio', () => {
  assert.deepEqual(ids({ ordem: 'menor' }), ['Serena', 'Lis', 'Aurora', 'Jasmim']);
  assert.deepEqual(ids({ ordem: 'maior' }), ['Aurora', 'Jasmim', 'Lis', 'Serena']);
  assert.equal(precoAtual(produto('zero', { preco_promocional: 0 })), 0);
});
test('filtros compartilhados sobrevivem à serialização; todas difere do padrão atual', () => {
  const filtros = { categoria: 'vestidos', colecao: '', tamanho: '54', ordem: 'maior', disponiveis: true };
  assert.deepEqual(lerFiltros(buscaDosFiltros(filtros)), filtros);
  assert.deepEqual(lerFiltros(''), filtrosIniciais);
  assert.equal(lerFiltros('?ordem=invalida').ordem, 'novidades');
});
test('foto principal prevalece sobre vídeos e ordenação; a lista original não é alterada', () => {
  const midias = [{ tipo: 'video', principal: true, ordem: 0, caminho_storage: 'video.mp4' },
    { tipo: 'foto', principal: false, ordem: 0, caminho_storage: 'secundaria.jpg' },
    { tipo: 'foto', principal: true, ordem: 8, caminho_storage: 'principal.jpg' }];
  assert.equal(fotoPrincipal(produto('imagem', { midias })).caminho_storage, 'principal.jpg');
  assert.equal(midias[0].tipo, 'video');
  assert.equal(fotoPrincipal(produto('sem-imagem')), null);
});
test('catálogo vazio é um resultado válido e filtros não alteram o catálogo de origem', () => {
  assert.deepEqual(selecionarProdutos({ ...catalogo, produtos: [], saldos: [] }, filtrosIniciais), []);
  const original = catalogo.produtos.map(p => p.id);
  ids({ ordem: 'maior' });
  assert.deepEqual(catalogo.produtos.map(p => p.id), original);
});
