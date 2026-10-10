import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {JSDOM} from 'jsdom';

test('histórico restaura filtros e posição; voltar fecha foto; tamanho zerado permite encomenda',async()=>{
  const mock={name:'catalogo-teste',transform(code,id){if(!id.endsWith('/src/catalogo.ts'))return;return code.replace('export async function carregarCatalogo(', 'async function carregarCatalogoReal(').replace('export function urlDaMidia(', 'function urlDaMidiaReal(')+'\nexport async function carregarCatalogo(){return globalThis.__catalogoTeste;}\nexport function urlDaMidia(c){return `https://example.test/${c}`;}';}};
  const bundle=await build({configFile:false,envFile:false,logLevel:'silent',plugins:[mock,react()],define:{'import.meta.env':'{}','process.env.NODE_ENV':'"development"'},build:{write:false,minify:false,lib:{entry:'tests/vitrine-harness.tsx',name:'TesteLoja',formats:['iife']}}});
  const code=(Array.isArray(bundle)?bundle[0]:bundle).output.find(x=>x.type==='chunk').code;
  const p={id:'1',codigo:'RM-0014',slug:'peca-rm-0014',nome:'Conjunto Azul',categoria_id:'conjuntos',colecao_id:null,preco:100,preco_promocional:null,selo:null,midias:Array.from({length:5},(_,i)=>({tipo:'foto',principal:i===0,ordem:i,caminho_storage:`foto-${i}.webp`,alt_texto:'Conjunto Azul'})),variacoes:[{id:'M',sku:'M',cor:'',tamanho:'M'},{id:'G',sku:'G',cor:'',tamanho:'G'}]};
  const c={categorias:[{id:'conjuntos',slug:'conjuntos',nome:'Conjuntos',ordem:0}],colecoes:[],produtos:[p],saldos:[{variacao_id:'M',produto_id:'1',cor:'',tamanho:'M',disponivel:1},{variacao_id:'G',produto_id:'1',cor:'',tamanho:'G',disponivel:0}],logoUrl:null,medidas:[]};
  const dom=new JSDOM('<div id="loja"></div>',{url:'https://example.test/#/loja',runScripts:'outside-only',beforeParse(w){w.scrollTo=(x,y)=>{w.scrollY=typeof x==='object'?x.top:y;};w.HTMLElement.prototype.scrollTo=function(o){this.scrollLeft=o.left;};w.MessageChannel=class{port1={onmessage:null};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.__catalogoTeste=c;}});
  dom.window.eval(code);const ui=dom.window.testeLoja;let sair;const d=dom.window.document;
  const clicar=sel=>ui.act(()=>d.querySelector(sel).click());
  const voltar=()=>ui.act(async()=>{dom.window.history.back();await new Promise(r=>setTimeout(r,30));});
  try{
    await ui.act(async()=>{sair=ui.montar();await new Promise(r=>setTimeout(r,20));});
    const initialLength=dom.window.history.length;
    await clicar('.s-cats button:nth-child(2)');
    await ui.act(()=>{const select=d.querySelector('#ordem');select.value='maior';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
    await clicar('.s-bar input[type=checkbox]');
    dom.window.scrollY=730;dom.window.dispatchEvent(new dom.window.Event('scroll'));
    await clicar('[data-produto] .im');
    assert.equal(dom.window.scrollY,0);assert.match(dom.window.location.hash,/produto/);assert.ok(dom.window.history.length>initialLength);
    await clicar('.sizes button[aria-label="Tamanho G esgotado"]');
    assert.equal(d.querySelector('.buy button').textContent,'Encomendar pelo WhatsApp');
    assert.equal(d.querySelector('.gal .selo-esgotado'),null,'Só um tamanho zerado não esmaece a peça inteira');
    let destino;dom.window.open=url=>{destino=url;};await clicar('.buy button');const msg=new URL(destino).searchParams.get('text');assert.match(msg,/RM-0014/);assert.match(msg,/Tamanho: G/);
    await clicar('.sizes button[aria-label="Tamanho M"]');assert.equal(d.querySelector('.buy button').textContent,'Comprar pelo WhatsApp');
    await clicar('[aria-label="Abrir foto 1 de Conjunto Azul"]');assert.ok(d.querySelector('.foto-tela'));assert.equal(d.querySelector('.foto-barra span').textContent,'1/5');
    await clicar('.foto-tela [aria-label="Próxima foto"]');assert.equal(d.querySelector('.foto-barra span').textContent,'2/5');
    await voltar();assert.equal(d.querySelector('.foto-tela'),null);assert.match(dom.window.location.hash,/produto/);
    await voltar();assert.equal(d.querySelector('.s-cats button[aria-pressed=true]').textContent,'Conjuntos');assert.equal(d.querySelector('#ordem').value,'maior');assert.equal(d.querySelector('.s-bar input').checked,true);assert.equal(dom.window.scrollY,730);
    await ui.act(async()=>{dom.window.history.forward();await new Promise(r=>setTimeout(r,30));});assert.match(dom.window.location.hash,/produto/);
    c.saldos[0].disponivel=0;
    await ui.act(async()=>{dom.window.dispatchEvent(new dom.window.Event('focus'));await new Promise(r=>setTimeout(r,20));});
    await clicar('.s-crumb a');assert.equal(d.querySelector('[data-produto] .esg').textContent,'Esgotado · Encomende');
  }finally{await ui.act(()=>sair?.());dom.window.close();}
});
