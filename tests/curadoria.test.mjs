import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pendenciasDaPeca,prepararUpload,entradaInterna} from '../apps/vitrine/src/painel/catalogoInterno.ts';
import {sessaoPorCodigo,telefoneDeAcesso,mensagemErroAcesso} from '../apps/vitrine/src/painel/acessoSemSenha.ts';
import {validarPrecos} from '../apps/vitrine/src/painel/precos.ts';
test('promoção vazia salva preço normal, menor salva e igual ou maior informa a correção',()=>{
  assert.deepEqual(validarPrecos('120',''),{preco:120,preco_promocional:null});
  assert.deepEqual(validarPrecos('120','99.90'),{preco:120,preco_promocional:99.9});
  assert.deepEqual(validarPrecos('',''),{preco:null,preco_promocional:null});
  for(const promo of ['120','121'])assert.throws(()=>validarPrecos('120',promo),/menor que o preço de venda.*deixe a promoção vazia/);
  assert.throws(()=>validarPrecos('','80'),/Informe o preço de venda/);
  assert.throws(()=>validarPrecos('100','99.999'),/duas casas decimais/);
});
test('acesso por canal validado distingue código de senha e rejeita métodos malformados',()=>{
  for(const method of ['otp','magiclink','invite'])assert.equal(sessaoPorCodigo([{method}]),true);
  for(const methods of [null,{},'otp',[],[{method:'password'}],[{method:'token_refresh'}],[null]])assert.equal(sessaoPorCodigo(methods),false);
  assert.equal(telefoneDeAcesso('(31) 98888-7777'),'+5531988887777');
  assert.equal(telefoneDeAcesso('+55 31 98888-7777'),'+5531988887777');
  assert.throws(()=>telefoneDeAcesso('123456'));
});
test('limites de envio não prometem entrega nem expõem erro interno do provedor',()=>{
  assert.match(mensagemErroAcesso({status:429}),/limite temporário/);
  assert.match(mensagemErroAcesso({code:'over_email_send_rate_limit'}),/último e-mail/);
  assert.match(mensagemErroAcesso({code:'phone_provider_disabled'}),/SMS ainda indisponível/);
});
test('rascunho iniciado com foto não inventa preço ou variações e não fica pronto para publicar',()=>{
  const p={nome:null,preco:null,categoria_id:null,midias:[{tipo:'foto',principal:true,ativo:true}],variacoes:[]};
  assert.deepEqual(pendenciasDaPeca(p),['nome','preço','categoria','variação e quantidade']);
  assert.deepEqual(pendenciasDaPeca({...p,nome:'Vestido',preco:100,categoria_id:'cat',variacoes:[{ativo:true,tamanho:'48',cor:'Preto',quantidade:0}]}),[]);
  assert.ok(pendenciasDaPeca({...p,variacoes:[{ativo:true,tamanho:'48',cor:'Preto',quantidade:''}]}).includes('variação e quantidade'));
});
test('upload aceita apenas mídia prevista e caminho próprio; recusa arquivo inválido ou grande',()=>{
  const pid='44000000-0000-0000-0000-000000000001',id='66000000-0000-0000-0000-000000000001';
  assert.deepEqual(prepararUpload({type:'image/webp',size:12000},pid,id),{caminho:`${pid}/${id}.webp`,tipo:'foto'});
  for(const file of [{type:'image/svg+xml',size:20},{type:'image/jpeg',size:0},{type:'video/mp4',size:51*1024*1024}])assert.throws(()=>prepararUpload(file,pid,id));
  assert.throws(()=>prepararUpload({type:'image/jpeg',size:20},'../outro',id));
});
test('painel usa host próprio; rota pública não recebe sessão da equipe',()=>{
  assert.equal(entradaInterna('rosemodas-painel-homologacao.vercel.app','/'),true);
  assert.equal(entradaInterna('homolog.rosemenezesmodas.com.br','/painel'),false);
  assert.equal(entradaInterna('127.0.0.1','/painel'),true);
});
test('curadoria preserva origem e uma única capa por peça, sem fabricar valores comerciais',async()=>{
  const lote=JSON.parse(await readFile('supabase/importacoes/curadoria-20261007.json','utf8'));
  assert.equal(lote.produtos.length,18);assert.equal(lote.produtos.flatMap(p=>p.midias).length,66);
  const ids=new Set();
  for(const p of lote.produtos){assert.ok(p.nome_sugerido);assert.equal(p.preco,undefined);assert.equal(p.quantidade,undefined);assert.equal(p.midias.filter(m=>m.principal).length,1);for(const m of p.midias){assert.ok(!ids.has(m.drive_id));ids.add(m.drive_id);assert.match(m.caminho_storage,new RegExp(`^${p.id}/`));assert.match(m.sha256,/^[a-f0-9]{64}$/);}}
});
