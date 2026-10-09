import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {colunas,lerCsv,validarEntrada,executarCarga,fonteGoogle,lerPlanilhaGoogle,PLANILHA_OFICIAL} from '../../scripts/lancamento/carga-oficial.mjs';
const linha=['RM-C001','Vestido oficial','Vestidos','Descrição oficial','120.50','','Azul','48','1','sim','1',''];
const csv=rows=>[colunas,...rows].map(r=>r.map(v=>/[",\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v).join(',')).join('\r\n');
async function fixture(fn){const p=await mkdtemp(path.join(os.tmpdir(),'rose-carga-'));try{await mkdir(path.join(p,'RM-C001'));await writeFile(path.join(p,'estoque-oficial.csv'),csv([linha]));await sharp({create:{width:300,height:500,channels:3,background:'#125789'}}).jpeg().toFile(path.join(p,'RM-C001','01.jpg'));await fn(p);}finally{await rm(p,{recursive:true,force:true});}}
test('CSV conserva acentos, aspas, separadores e descrição com quebra de linha',()=>{
 const a=[...linha];a[3]='Descrição, com "aspas"\ne nova linha';const rows=lerCsv('\uFEFF'+csv([a]));assert.equal(rows[0].dados.descricao_curta,a[3]);assert.equal(rows[0].numero,2);
 assert.throws(()=>lerCsv('coluna\nvalor'),/12 colunas/);assert.throws(()=>lerCsv(csv([linha])+'\n"aberta'),/fechadas/);
});
test('carga válida mantém proporção, comprime em WebP, capa 01 e ordenação numérica',async()=>fixture(async p=>{
 await sharp({create:{width:200,height:100,channels:3,background:'red'}}).png().toFile(path.join(p,'RM-C001','10.png'));
 const r=await validarEntrada(p,['Vestidos']);assert.deepEqual(r.erros,[]);assert.deepEqual(r.manifesto[0].fotos.map(f=>f.ordem),[1,10]);assert.equal(r.manifesto[0].preco_promocional,null);
 const m=await sharp(r.arquivos.find(a=>a.origem.endsWith('01.jpg')).bytes).metadata();assert.equal(m.format,'webp');assert.equal(m.width/m.height,300/500);
}));
for(const [rotulo,coluna,valor,mensagem] of [
 ['preço zero',4,'0','preço deve'],['preço inválido',4,'abc','preço deve'],['preço negativo',4,'-10','preço deve'],['promoção igual',5,'120.50','promoção deve'],['promoção maior',5,'130','promoção deve'],['promoção inválida',5,'abc','promoção deve'],['estoque negativo',8,'-1','estoque deve'],['estoque fracionado',8,'1.5','estoque deve'],['categoria inexistente',2,'Nova categoria','não cadastrada'],['nome vazio',1,'','preencha nome'],['tamanho vazio',7,'','preencha tamanho'],['publicação inválida',9,'talvez','publicar deve'],['ordem negativa',10,'-1','ordem da vitrine']]){
 test(`validação bloqueia ${rotulo} e não grava`,async()=>fixture(async p=>{const l=[...linha];l[coluna]=valor;await writeFile(path.join(p,'estoque-oficial.csv'),csv([l]));const r=await validarEntrada(p,['Vestidos']);assert.ok(r.erros.some(e=>e.includes(mensagem)));let gravacoes=0;const sb={rpc:async nome=>{assert.equal(nome,'contexto_carga_oficial');return{data:{categorias:['Vestidos']}};},storage:{from:()=>{gravacoes++;throw Error('NÃO pode gravar');}}};const resultado=await executarCarga({sb,pasta:p});assert.equal(resultado.status,'erros_validacao');assert.equal(gravacoes,0);}));
}
test('código duplicado, capa ausente, fotos órfãs, números repetidos e imagens corrompidas bloqueiam o lote inteiro',async()=>fixture(async p=>{
 await writeFile(path.join(p,'estoque-oficial.csv'),csv([linha,linha]));await rm(path.join(p,'RM-C001','01.jpg'));await mkdir(path.join(p,'RM-C999'));await writeFile(path.join(p,'RM-C001','02.jpg'),'isto não é imagem');await writeFile(path.join(p,'RM-C001','02.png'),'também não');await writeFile(path.join(p,'RM-C001','03.txt'),'texto');
 const r=await validarEntrada(p,['Vestidos']);for(const texto of ['duplicado','foto 01','sem peça','corrompida','repetido','use imagens'])assert.ok(r.erros.some(e=>e.includes(texto)),texto);
}));
test('linha não publicada é ignorada sem validar campos ou fotos',async()=>fixture(async p=>{const l=[...linha];l[9]='não';l[5]='90,00';await writeFile(path.join(p,'estoque-oficial.csv'),csv([l]));await rm(path.join(p,'RM-C001','01.jpg'));const r=await validarEntrada(p,['Vestidos']);assert.deepEqual(r.erros,[]);assert.deepEqual(r.manifesto,[]);assert.deepEqual(r.arquivos,[]);assert.equal(r.ignoradas.length,1);}));

test('uma peça admite três variações, mantém primeira linha e rejeita divergências',async()=>fixture(async p=>{
 const rows=[linha,[...linha],[...linha]];rows[1][6]='Preto';rows[1][7]='M';rows[2][7]='GG';
 await writeFile(path.join(p,'estoque-oficial.csv'),csv(rows));let r=await validarEntrada(p,['Vestidos']);assert.deepEqual(r.erros,[]);assert.equal(r.manifesto.length,1);assert.equal(r.manifesto[0].variacoes.length,3);assert.equal(r.arquivos.length,1);
 const hash=r.manifesto[0].assinatura_carga;r=await validarEntrada(p,['Vestidos']);assert.equal(r.manifesto[0].assinatura_carga,hash,'UUID do lote não modifica a assinatura');
 rows[1][1]='Outro nome';await writeFile(path.join(p,'estoque-oficial.csv'),csv(rows));r=await validarEntrada(p,['Vestidos']);assert.ok(r.erros.some(e=>e.includes('nome diverge da primeira linha 2')));
}));
test('linhas parciais com não ou vazio não alteram a peça existente',async()=>fixture(async p=>{
 const vazia=colunas.map(()=>''),nao=[...vazia];vazia[0]='RM-C001';nao[0]='RM-C002';nao[9]='não';
 await writeFile(path.join(p,'estoque-oficial.csv'),csv([vazia,nao]));const r=await validarEntrada(p,['Vestidos']);assert.deepEqual(r.erros,[]);assert.equal(r.manifesto.length,0);assert.equal(r.ignoradas.length,2);
 let gravacoes=0;const resultado=await executarCarga({sb:{rpc:async()=>({data:{categorias:['Vestidos']}}),storage:{from:()=>{gravacoes++;}}},pasta:p});assert.equal(resultado.status,'concluido');assert.equal(gravacoes,0);
}));
test('leitor usa o ID oficial do Google, preserva colunas e ignora CSV de referência',async()=>fixture(async p=>{
 const rows=[...linha];rows[1]='Nome lido do Google';const fonte=fonteGoogle([colunas,rows]);
 const r=await validarEntrada(p,['Vestidos'],undefined,fonte);assert.deepEqual(r.erros,[]);assert.equal(r.manifesto[0].nome,'Nome lido do Google');assert.equal(fonte.proveniencia.spreadsheet_id,PLANILHA_OFICIAL);
 assert.throws(()=>fonteGoogle([colunas,rows],{spreadsheet_id:'CSV-ANTIGO'}),/fonte precisa/);
 let chamou=false;const lido=await lerPlanilhaGoogle({accessToken:'token-fixture',fetcher:async(url,op)=>{chamou=true;assert.ok(url.includes(PLANILHA_OFICIAL));assert.equal(op.headers.Authorization,'Bearer token-fixture');return{ok:true,json:async()=>({values:[colunas,rows]})};}});assert.ok(chamou);assert.equal(lido.linhas[0].dados.nome,rows[1]);
}));
