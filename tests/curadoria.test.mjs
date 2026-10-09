import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pendenciasDaPeca,prepararUpload,entradaInterna,embalagemEfetiva} from '../apps/vitrine/src/painel/catalogoInterno.ts';
import {mensagemErroSenha} from '../apps/vitrine/src/auth/acesso.ts';
import {validarPrecos} from '../apps/vitrine/src/painel/precos.ts';
test('promoção vazia salva preço normal, menor salva e igual ou maior informa a correção',()=>{
  assert.deepEqual(validarPrecos('120',''),{preco:120,preco_promocional:null});
  assert.deepEqual(validarPrecos('120','99.90'),{preco:120,preco_promocional:99.9});
  assert.deepEqual(validarPrecos('',''),{preco:null,preco_promocional:null});
  for(const promo of ['120','121'])assert.throws(()=>validarPrecos('120',promo),/menor que o preço de venda.*deixe a promoção vazia/);
  assert.deepEqual(validarPrecos('','80'),{preco:null,preco_promocional:80});
  assert.throws(()=>validarPrecos('100','99.999'),/duas casas decimais/);
});
test('senha apresenta erros claros sem distinguir contas nem disparar e-mail',()=>{
  assert.match(mensagemErroSenha({code:'invalid_credentials'}),/E-mail não cadastrado ou senha incorreta/);
  assert.match(mensagemErroSenha({status:429}),/Muitas tentativas/);
  assert.match(mensagemErroSenha({code:'weak_password'}),/8 caracteres/);
});
test('rascunho iniciado com foto não inventa preço ou variações e não fica pronto para publicar',()=>{
  const p={nome:null,preco:null,categoria_id:null,midias:[{tipo:'foto',principal:true,ativo:true}],variacoes:[]};
  assert.deepEqual(pendenciasDaPeca(p),['nome','preço']);
  assert.deepEqual(pendenciasDaPeca({...p,nome:'Vestido',preco:100,categoria_id:'cat',variacoes:[{ativo:true,tamanho:'48',cor:'Preto',quantidade:0}]}),[]);
  assert.deepEqual(pendenciasDaPeca({...p,nome:'Vestido',preco:100}),[]);
});
test('upload aceita apenas mídia prevista e caminho próprio; recusa arquivo inválido ou grande',()=>{
  const pid='44000000-0000-0000-0000-000000000001',id='66000000-0000-0000-0000-000000000001';
  assert.deepEqual(prepararUpload({type:'image/webp',size:12000},pid,id),{caminho:`${pid}/${id}.webp`,tipo:'foto'});
  for(const file of [{type:'image/svg+xml',size:20},{type:'image/jpeg',size:0},{type:'video/mp4',size:51*1024*1024}])assert.throws(()=>prepararUpload(file,pid,id));
  assert.throws(()=>prepararUpload({type:'image/jpeg',size:20},'../outro',id));
});
test('painel usa host próprio; rota pública não recebe sessão da equipe',()=>{
  assert.equal(entradaInterna('rosemodas-painel-homologacao.vercel.app','/'),true);
  assert.equal(entradaInterna('homolog.rosemenezesmodas.com.br','/painel'),true);
  assert.equal(entradaInterna('127.0.0.1','/painel'),true);
});
test('curadoria preserva origem e uma única capa por peça, sem fabricar valores comerciais',async()=>{
  const lote=JSON.parse(await readFile('supabase/importacoes/curadoria-20261007.json','utf8'));
  assert.equal(lote.produtos.length,18);assert.equal(lote.produtos.flatMap(p=>p.midias).length,66);
  const ids=new Set();
  for(const p of lote.produtos){assert.ok(p.nome_sugerido);assert.equal(p.preco,undefined);assert.equal(p.quantidade,undefined);assert.equal(p.midias.filter(m=>m.principal).length,1);for(const m of p.midias){assert.ok(!ids.has(m.drive_id));ids.add(m.drive_id);assert.match(m.caminho_storage,new RegExp(`^${p.id}/`));assert.match(m.sha256,/^[a-f0-9]{64}$/);}}
});

test('preços com vírgula são convertidos sem trocar os centavos',()=>{assert.deepEqual(validarPrecos('189,90','159,90'),{preco:189.9,preco_promocional:159.9});assert.throws(()=>validarPrecos('1.899,90',''),/valor válido/);});
test('embalagem usa cada valor próprio antes do padrão da categoria, sem inventar campos vazios',()=>{assert.deepEqual(embalagemEfetiva({peso_g:420,altura_dobrada_cm:null},{peso_g:'300',altura_cm:'5',largura_cm:'20'}),{peso_g:420,altura_cm:5,largura_cm:20,comprimento_cm:null});assert.deepEqual(embalagemEfetiva({}),{peso_g:null,largura_cm:null,altura_cm:null,comprimento_cm:null});});
