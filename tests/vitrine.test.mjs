import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { filtrosIniciais, selecionarProdutos, linkWhatsApp, linkInstagram, numeroWhatsApp, buscaDosFiltros, lerFiltros } from '../apps/vitrine/src/catalogo.ts';
test('busca por nome com acentos ou código preserva isolamento dos filtros e a sequência da coleção', () => {
 const c={categorias:[],colecoes:[],produtos:[{id:'1',codigo:'HOM-RM01',nome:'Vestido Íris',selo:null},{id:'2',codigo:'HOM-RM02',nome:'Blusa',selo:null},{id:'3',codigo:'HOM-RM03',nome:'Conjunto',selo:'novidade'}],saldos:[]};
 assert.deepEqual(selecionarProdutos(c,filtrosIniciais).map(p=>p.codigo),['HOM-RM03','HOM-RM01','HOM-RM02']);
 assert.deepEqual(selecionarProdutos(c,{...filtrosIniciais,busca:'iris'}).map(p=>p.id),['1']);
 assert.deepEqual(selecionarProdutos(c,{...filtrosIniciais,busca:'rm02'}).map(p=>p.id),['2']);
 const f={...filtrosIniciais,busca:'Íris'};assert.deepEqual(lerFiltros(buscaDosFiltros(f)),f);
});
test('contatos públicos validam destino e codificam a mensagem sem aceitar URLs arbitrárias', () => {
 assert.equal(numeroWhatsApp('número pendente'),null);assert.equal(linkWhatsApp(null,'oi'),null);
 const u=new URL(linkWhatsApp('+55 (31) 99999-9999','Peça Íris & tamanho 48?'));
 assert.equal(u.origin,'https://wa.me');assert.equal(u.searchParams.get('text'),'Peça Íris & tamanho 48?');
 assert.equal(linkInstagram('javascript:alert(1)'),null);assert.equal(linkInstagram('https://instagram.com.example.org/rose'),null);
 assert.equal(linkInstagram('https://www.instagram.com/rose/'),'https://www.instagram.com/rose/');
});
test('catálogo fiel ao mockup tem 12 modelos, cores, medidas e seed idempotente protegido por ambiente', async () => {
 const db=new PGlite({extensions:{pg_trgm}});
 try {
 await db.exec(await readFile('tests/database/platform-fixture.sql','utf8'));
 for(const n of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(`supabase/migrations/${n}`,'utf8'));
 const seed=await readFile('supabase/seeds/homologacao-mockup.sql','utf8');
 await assert.rejects(db.exec(seed),/projeto não é a homologação autorizada/);await db.exec('rollback');
 await db.exec(`insert into public.configuracoes(chave,valor) values('ambiente_homologacao','{"project_ref":"kernpudxhwkpoadahgqj","uso":"homologacao"}');`);
 await db.exec(await readFile('supabase/seeds/homologacao-catalogo.sql','utf8'));await db.exec(seed);
 const resumo=async()=> (await db.query(`select (select count(*) from public.produtos)::int produtos,(select count(*) from public.variacoes)::int variacoes,(select count(*) from public.medidas_tamanho)::int medidas,(select sum(estoque_fisico) from public.variacoes)::int estoque,(select count(*) from public.movimentos_estoque)::int movimentos,(select count(*) from public.audit_log)::int auditoria`)).rows[0];
 const antes=await resumo();assert.equal(antes.produtos,12);assert.equal(antes.variacoes,96);assert.equal(antes.medidas,216);assert.equal(antes.estoque,181);
 await db.exec(seed);assert.deepEqual(await resumo(),antes,'Reaplicação não deve recriar movimentos nem alterar cadastros');
 assert.equal((await db.query(`select count(*)::int n from public.variacoes where cor='Demonstrativa'`)).rows[0].n,0);
 await db.exec(`insert into public.configuracoes(chave,valor) values('whatsapp_numero','"5531999999999"'),('instagram_url','"https://instagram.com/rose/"'),('segredo_interno','"não publicar"');set role anon;`);
 assert.deepEqual((await db.query('select chave from public.configuracoes order by chave')).rows.map(r=>r.chave),['instagram_url','whatsapp_numero']);
 assert.equal((await db.query('select produto_id,tamanho,rotulo,valor_cm from public.medidas_tamanho')).rows.length,216);
 assert.equal((await db.query('select produto_id,tamanho,cor,disponivel from public.v_estoque_disponivel')).rows.length,96);
 await assert.rejects(db.query('select custo_medio from public.variacoes'),e=>e.code==='42501');
 await assert.rejects(db.query('select * from public.audit_log'),e=>e.code==='42501');
 await db.exec('reset role');
 assert.equal((await db.query(`select count(*)::int n from pg_tables where schemaname='public'`)).rows[0].n,9);
 } finally {await db.close();}
});
