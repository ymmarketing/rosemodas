import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {fileURLToPath} from 'node:url';

async function carregar(url){
 const r=await build({configFile:false,envFile:false,logLevel:'silent',resolve:{alias:{'@vercel/analytics':fileURLToPath(new URL('./metricas-mock.mjs',import.meta.url))}},define:{'import.meta.env':JSON.stringify({PROD:true})},build:{write:false,minify:false,lib:{entry:'apps/vitrine/src/metricas.ts',name:'Metricas',formats:['iife']}}});
 const codigo=(Array.isArray(r)?r[0]:r).output.find(x=>x.type==='chunk').code;
 const dom=new JSDOM('',{url,runScripts:'outside-only'});dom.window.eval(codigo);return {dom,m:dom.window.Metricas,chamadas:()=>dom.window.__metricas};
}

test('caminho limpo: sem filtros, busca ou hash; peças agrupadas numa rota',async()=>{
 const {m,dom}=await carregar('https://loja.test/');
 assert.equal(m.caminhoDaVitrine(''),'/');
 assert.equal(m.caminhoDaVitrine('#/loja?categoria=vestidos&busca=maria'),'/');
 assert.equal(m.caminhoDaVitrine('#/loja/produto/vestido-floral?x=1'),'/loja/produto/vestido-floral');
 assert.equal(m.rotaDaVitrine('/loja/produto/vestido-floral'),'/loja/produto/[peca]');
 assert.equal(m.rotaDaVitrine('/loja/trocas'),'/loja/trocas');
 dom.window.close();
});

test('UF do CEP sem nunca guardar o CEP',async()=>{
 const {m,dom}=await carregar('https://loja.test/');
 assert.equal(m.ufDoCep('30640-140'),'MG');assert.equal(m.ufDoCep('01310100'),'SP');assert.equal(m.ufDoCep('69900000'),'AC');
 assert.equal(m.ufDoCep('70040010'),'DF');assert.equal(m.ufDoCep('90010000'),'RS');assert.equal(m.ufDoCep('123'),'');
 dom.window.close();
});

test('vitrine registra visita e eventos; URL enviada sem filtros; nada antes de iniciar',async()=>{
 const {m,dom,chamadas}=await carregar('https://loja.test/?colecao=lancamento#/loja/produto/vestido-floral?busca=ana');
 m.evento('whatsapp_comprar',{peca:'RM-0001'});m.registrarVisita();
 assert.equal(chamadas().length,0,'nada é enviado antes de iniciar');
 m.iniciarMetricas();m.iniciarMetricas();
 const injects=chamadas().filter(c=>c[0]==='inject');assert.equal(injects.length,1);
 const opcoes=injects[0][1];assert.equal(opcoes.disableAutoTrack,true);assert.equal(opcoes.mode,'production');
 assert.equal(opcoes.beforeSend({type:'pageview',url:dom.window.location.href}).url,'https://loja.test/loja/produto/vestido-floral');
 m.registrarVisita();m.registrarVisita();
 const visitas=chamadas().filter(c=>c[0]==='pageview');assert.equal(visitas.length,1,'mesma página não conta duas vezes seguidas');
 assert.deepEqual({...visitas[0][1]},{route:'/loja/produto/[peca]',path:'/loja/produto/vestido-floral'});
 m.evento('whatsapp_comprar',{peca:'RM-0001',categoria:'vestidos'});
 assert.deepEqual([...chamadas().filter(c=>c[0]==='track').map(c=>c[1])],['whatsapp_comprar']);
 dom.window.close();
});

test('painel e área da cliente nunca são medidos',async()=>{
 for(const url of ['https://loja.test/#/painel','https://loja.test/painel/pecas','https://loja.test/#/cliente']){
  const {m,dom,chamadas}=await carregar(url);m.iniciarMetricas();
  const opcoes=chamadas().find(c=>c[0]==='inject')[1];
  m.registrarVisita();m.evento('whatsapp_geral',{origem:'teste'});
  assert.equal(chamadas().filter(c=>c[0]!=='inject').length,0,url);
  assert.equal(opcoes.beforeSend({type:'pageview',url}),null,url);
  dom.window.close();
 }
});
