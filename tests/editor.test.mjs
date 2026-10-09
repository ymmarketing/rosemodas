import {before,after,afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {JSDOM} from 'jsdom';

let codigo,dom,ui,desmontar,chamadas,peca,fechou;
before(async()=>{
  const pacote=await build({configFile:false,envFile:false,logLevel:'silent',plugins:[react()],
    define:{'import.meta.env':'{}','process.env.NODE_ENV':'"development"'},build:{write:false,minify:false,lib:{entry:'tests/editor-harness.tsx',name:'EditorTeste',formats:['iife']}}});
  codigo=(Array.isArray(pacote)?pacote[0]:pacote).output.find(x=>x.type==='chunk').code;
});
afterEach(async()=>{if(desmontar)await ui.act(()=>desmontar());dom?.window.close();desmontar=null;});
after(()=>{codigo=null;});

async function montar({variacoes=[],operacao}={}){
  dom=new JSDOM('<div id="editor"></div>',{url:'https://painel.example.test/',runScripts:'outside-only',beforeParse(window){
    // jsdom não implementa MessageChannel; act precisa somente da fila de tarefas.
    window.MessageChannel=class{port1={onmessage:null};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};
  }});
  dom.window.eval(codigo);ui=dom.window.testeEditor;chamadas=[];fechou=false;
  peca={id:'44000000-0000-4000-8000-000000000001',codigo:'TESTE-DESCARTAVEL',nome:'Peça fictícia',descricao:'Somente teste',
    preco:50,preco_promocional:null,categoria_id:'categoria',colecao_id:'colecao',modelo_veste:null,status_catalogo:'rascunho',ativo:false,
    atualizado_em:'2026-10-07T21:00:00Z',midias:[{id:'foto',tipo:'foto',principal:true,ativo:true,alt_texto:'Foto de teste',caminho_storage:'',ordem:0}],variacoes,medidas:[]};
  const servidor=async(acao,id,dados)=>{
    chamadas.push({acao,id,dados});if(operacao)return operacao(acao,id,dados);
    if(acao==='salvar')peca={...peca,...dados,variacoes:(dados.variacoes.length?dados.variacoes:[{id:'padrao',cor:'',tamanho:'',quantidade:1,ativo:true}]).map(v=>({...v,sku:v.sku||'SKU-TESTE'})),atualizado_em:'2026-10-07T21:01:00Z'};
    if(acao==='publicar')peca={...peca,ativo:true,status_catalogo:'publicado',atualizado_em:'2026-10-07T21:02:00Z'};
    if(acao==='rascunho')peca={...peca,ativo:false,status_catalogo:'rascunho',atualizado_em:'2026-10-07T21:03:00Z'};
    return structuredClone(peca);
  };
  await ui.act(()=>{desmontar=ui.montar({inicial:peca,lista:{itens:[],total:0,categorias:[{id:'categoria',nome:'Categoria fictícia'}],colecoes:[{id:'colecao',nome:'Atual fictícia'}]},fechar(){fechou=true;},salvou(){},operacao:servidor});});
}
const botao=nome=>[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent===nome);
async function clicar(nome){const b=botao(nome);assert.ok(b,`Botão presente: ${nome}`);await ui.act(async()=>{b.click();});}
async function preencher(nome,valor){
  const label=[...dom.window.document.querySelectorAll('label.field')].find(l=>l.querySelector('span')?.textContent===nome);
  const input=label.querySelector('input');
  await ui.act(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,valor);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
}
const alerta=()=>dom.window.document.querySelector('[role=alert]');

test('Publicar salva direto e não exige cor, tamanho ou categoria',async()=>{
 await montar();await clicar('Publicar na vitrine');assert.equal(alerta(),null);assert.equal(peca.ativo,true);assert.deepEqual(chamadas.map(x=>x.acao),['salvar','publicar']);assert.equal(peca.variacoes[0].quantidade,1);
});
test('variações opcionais, preço com vírgula e publicação usam o último estado salvo',async()=>{
 await montar();await clicar('+ Variação');await preencher('Quantidade','2');await preencher('Preço de venda (R$)','189,90');await clicar('Publicar na vitrine');assert.equal(alerta(),null);assert.equal(chamadas[0].dados.preco,189.9);assert.equal(chamadas[0].dados.variacoes[0].cor,'');assert.equal(chamadas[0].dados.variacoes[0].tamanho,'');assert.equal(peca.ativo,true);
 await clicar('Retirar da vitrine');assert.equal(peca.ativo,false);
});
test('promoção vazia e menor salvam; igual rejeita com mensagem e não envia alteração ao banco',async()=>{
  await montar();await clicar('Salvar alterações');assert.equal(chamadas[0].dados.preco_promocional,null);
  await preencher('Preço promocional (R$)','40');await clicar('Salvar alterações');assert.equal(chamadas[1].dados.preco_promocional,40);
  await preencher('Preço promocional (R$)','50');await clicar('Salvar alterações');assert.match(alerta().textContent,/menor que o preço de venda/);assert.equal(chamadas.length,2);assert.equal(peca.preco_promocional,40);
});
test('erro real de RPC é visível e permite tentar publicar novamente',async()=>{
  let falhou=true;
  await montar({variacoes:[{id:'var',sku:'SKU',ativo:true,tamanho:'48',cor:'Cor fictícia',quantidade:1}],operacao:async()=>{if(falhou)throw new dom.window.Error('Não foi possível publicar. Tente novamente.');return {...peca,ativo:true,status_catalogo:'publicado'};}});
  await clicar('Publicar na vitrine');assert.match(alerta().textContent,/Não foi possível publicar/);assert.equal(botao('Publicar na vitrine').disabled,false);
  falhou=false;await clicar('Publicar na vitrine');assert.equal(alerta(),null);assert.ok(botao('Retirar da vitrine'));
});
test('rascunho aceita campos incompletos; quantidade negativa continua inválida',async()=>{
 await montar();await preencher('Nome da peça','');await preencher('Preço de venda (R$)','');await clicar('Salvar alterações');assert.equal(chamadas.length,1);assert.equal(chamadas[0].dados.preco,null);
 await clicar('+ Variação');await preencher('Quantidade','-1');await clicar('Salvar alterações');assert.equal(chamadas.length,1);
});
test('Voltar avisa na página e permite continuar, descartar ou salvar',async()=>{
 await montar();await preencher('Nome da peça','Alterada');await clicar('Voltar ao catálogo');assert.ok(dom.window.document.querySelector('[role=alertdialog]'));assert.equal(fechou,false);
 await clicar('Continuar editando');assert.equal(dom.window.document.querySelector('[role=alertdialog]'),null);
 await clicar('Voltar ao catálogo');await clicar('Salvar');assert.equal(fechou,true);assert.equal(chamadas[0].dados.nome,'Alterada');
});
test('Publicação incompleta explica junto ao campo, sem obrigar categoria/variação',async()=>{
 await montar();await preencher('Nome da peça','');await clicar('Publicar na vitrine');assert.match(alerta().textContent,/nome/);assert.match(dom.window.document.querySelector('.erro-campo').textContent,/nome/);assert.equal(peca.ativo,false);
});
test('publicação em andamento bloqueia cliques repetidos até a confirmação',async()=>{
  let concluir;
  await montar({variacoes:[{id:'var',sku:'SKU',ativo:true,tamanho:'48',cor:'Cor fictícia',quantidade:1}],operacao:()=>new Promise(r=>{concluir=r;})});
  await clicar('Publicar na vitrine');assert.equal(botao('Publicar na vitrine').disabled,true);await clicar('Publicar na vitrine');assert.equal(chamadas.length,1);
  await ui.act(()=>concluir({...peca,ativo:true,status_catalogo:'publicado'}));assert.ok(botao('Retirar da vitrine'));
});

test('Arquivar exige confirmação na própria página e Cancelar não envia escrita',async()=>{
 await montar();await clicar('Arquivar peça');assert.ok(dom.window.document.querySelector('[aria-label="Confirmar arquivamento"]'));assert.equal(chamadas.length,0);
 await clicar('Cancelar');assert.equal(chamadas.length,0);assert.equal(fechou,false);
 await clicar('Arquivar peça');await clicar('Arquivar');assert.equal(chamadas[0].acao,'arquivar');assert.equal(fechou,true);
});
