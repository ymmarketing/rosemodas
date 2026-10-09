import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {JSDOM} from 'jsdom';
test('rodapé e menu navegam entre páginas institucionais sem recarregar ou abrir área da cliente',async()=>{
 const bundle=await build({configFile:false,envFile:false,logLevel:'silent',plugins:[react()],define:{'import.meta.env':'{}','process.env.NODE_ENV':'"development"'},build:{write:false,minify:false,lib:{entry:'tests/vitrine-harness.tsx',name:'TesteLoja',formats:['iife']}}});
 const code=(Array.isArray(bundle)?bundle[0]:bundle).output.find(x=>x.type==='chunk').code;
 const dom=new JSDOM('<div id="loja"></div>',{url:'https://example.test/#/loja/privacidade',runScripts:'outside-only',beforeParse(w){w.scrollTo=()=>{};w.MessageChannel=class{port1={onmessage:null};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};}});
 dom.window.eval(code);const ui=dom.window.testeLoja;let sair;
 try{
 await ui.act(()=>{sair=ui.montar();});assert.match(dom.window.document.querySelector('h1').textContent,/privacidade/);
 for(const [rota,titulo] of [['trocas','Trocas e devoluções'],['quem-somos','Rose Menezes Moda Feminina'],['privacidade','Política de privacidade']]){
 await ui.act(async()=>{dom.window.document.querySelector(`footer a[href="#/loja/${rota}"]`).click();await new Promise(r=>setTimeout(r,20));});assert.equal(dom.window.document.querySelector('h1').textContent,titulo);
 }
 await ui.act(()=>dom.window.document.querySelector('[aria-label="Abrir menu"]').click());
 await ui.act(()=>dom.window.document.querySelector('[role="dialog"] a[href="#/loja/trocas"]').click());assert.equal(dom.window.document.querySelector('h1').textContent,'Trocas e devoluções');
 assert.equal(dom.window.document.querySelectorAll('a[href*="cliente"]').length,0);
 for(const txt of ['Frete grátis','Cartão até','CNPJ 00','Texto de exemplo','Solicitar troca na sua área'])assert.ok(!dom.window.document.body.textContent.includes(txt));
 }finally{await ui.act(()=>sair());dom.window.close();}
});
