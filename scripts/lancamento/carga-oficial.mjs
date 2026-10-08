/** Carga oficial: validar todos os arquivos, backup privado, staging, transação e retirada das fotos antigas. */
import {readFile,readdir,mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
export const colunas=['codigo','nome','categoria','descricao_curta','preco','preco_promocional','cor','tamanho','estoque','publicar','ordem_vitrine','observacoes'];
const sha=b=>createHash('sha256').update(b).digest('hex');
export function lerCsv(texto){
 const fonte=texto.replace(/^\uFEFF/,'');const delim=fonte.split(/\r?\n/)[0].includes(';')?';':',';
 const linhas=[];let linha=[],campo='',aspas=false,fechou=false,numero=1,inicio=1;
 for(let i=0;i<fonte.length;i++){
  const c=fonte[i];
  if(aspas){if(c==='"'){if(fonte[i+1]==='"'){campo+='"';i++;}else{aspas=false;fechou=true;}}else{campo+=c;if(c==='\n')numero++;}continue;}
  if(c==='"'){if(campo||fechou)throw new Error(`Linha ${numero}: aspas fora de posição.`);aspas=true;continue;}
  if(c===delim){linha.push(campo);campo='';fechou=false;continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&fonte[i+1]==='\n')i++;linha.push(campo);if(linha.some(v=>v.trim()))linhas.push({numero:inicio,valores:linha});numero++;inicio=numero;linha=[];campo='';fechou=false;continue;}
  if(fechou)throw new Error(`Linha ${numero}: texto após o fechamento de aspas.`);campo+=c;
 }
 if(aspas)throw new Error(`Linha ${inicio}: aspas não foram fechadas.`);
 if(campo||linha.length){linha.push(campo);if(linha.some(v=>v.trim()))linhas.push({numero:inicio,valores:linha});}
 if(JSON.stringify(linhas[0]?.valores)!==JSON.stringify(colunas))throw new Error('A primeira linha deve conter exatamente as 12 colunas do modelo, na mesma ordem.');
 return linhas.slice(1).map(l=>({...l,dados:Object.fromEntries(colunas.map((c,i)=>[c,(l.valores[i]??'').trim()]))}));
}
function dinheiro(s){if(!/^\d+(?:[.,]\d{1,2})?$/.test(s))return null;const v=Number(s.replace(',','.'));return Number.isFinite(v)&&v<=9999999999.99?v:null;}
export async function validarEntrada(pasta,categorias,lote=randomUUID()){
 const erros=[],manifesto=[],arquivos=[];let linhas;
 try{linhas=lerCsv(await readFile(path.join(pasta,'estoque-oficial.csv'),'utf8'));}catch(e){return{erros:[e.message],manifesto,arquivos,lote};}
 if(!linhas.length)erros.push('A planilha precisa conter pelo menos uma peça.');
 const vistos=new Set(),permitidas=new Set(categorias.map(c=>typeof c==='string'?c:c.nome));
 const pastas=await readdir(pasta,{withFileTypes:true});
 for(const entrada of pastas){
  if(entrada.isSymbolicLink())erros.push(`Arquivo ${entrada.name}: links simbólicos não são permitidos.`);
  else if(entrada.isDirectory()&&!linhas.some(l=>l.dados.codigo===entrada.name))erros.push(`Pasta ${entrada.name}: fotos sem peça na planilha.`);
  else if(entrada.isFile()&&entrada.name!=='estoque-oficial.csv'&&!entrada.name.startsWith('.'))erros.push(`Arquivo ${entrada.name}: coloque as fotos dentro da pasta do código da peça.`);
 }
 for(const l of linhas){
  const d=l.dados,label=`Linha ${l.numero} (${d.codigo||'sem código'})`;
  if(l.valores.length!==colunas.length)erros.push(`${label}: quantidade de colunas diferente do modelo.`);
  for(const k of ['codigo','nome','categoria','descricao_curta','preco','cor','tamanho','estoque','publicar'])if(!d[k])erros.push(`${label}: preencha ${k}.`);
  if(!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(d.codigo))erros.push(`${label}: código inválido. Use letras maiúsculas, números e hífen.`);
  if(vistos.has(d.codigo))erros.push(`${label}: código duplicado.`);vistos.add(d.codigo);
  if(!permitidas.has(d.categoria))erros.push(`${label}: categoria “${d.categoria}” não cadastrada. Uma categoria nova precisa ser cadastrada antes da carga.`);
  const preco=dinheiro(d.preco),promocional=d.preco_promocional?dinheiro(d.preco_promocional):null;
  if(preco===null||preco<=0)erros.push(`${label}: preço deve ser maior que zero, com até duas casas decimais.`);
  if(d.preco_promocional&&(promocional===null||promocional>=preco))erros.push(`${label}: promoção deve ser um valor válido e menor que o preço.`);
  if(!/^\d+$/.test(d.estoque)||Number(d.estoque)>2147483647)erros.push(`${label}: estoque deve ser um inteiro de zero a 2147483647.`);
  if(d.ordem_vitrine&&(!/^\d+$/.test(d.ordem_vitrine)||Number(d.ordem_vitrine)>2147483647))erros.push(`${label}: ordem da vitrine deve ser um inteiro não negativo.`);
  const publicar=d.publicar.toLocaleLowerCase('pt-BR');if(!['sim','não','nao'].includes(publicar))erros.push(`${label}: publicar deve ser sim ou não.`);
  const fotos=[],ordens=new Set(),dir=path.join(pasta,d.codigo);
  if(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(d.codigo)&&pastas.some(p=>p.name===d.codigo&&p.isDirectory())){
   for(const f of await readdir(dir,{withFileTypes:true})){
    if(f.name.startsWith('.'))continue;
    const nome=`${d.codigo}/${f.name}`,m=/^(\d{2,})\.(jpe?g|png|webp)$/i.exec(f.name);
    if(!f.isFile()||!m){erros.push(`Arquivo ${nome}: use imagens JPG, PNG ou WebP numeradas como 01.jpg.`);continue;}
    const ordem=Number(m[1]);if(ordem<1||ordens.has(ordem)){erros.push(`Arquivo ${nome}: número repetido ou inválido.`);continue;}ordens.add(ordem);
    try{
     const s=await stat(path.join(dir,f.name));if(s.size>50*1024*1024||s.size===0)throw new Error('imagem vazia ou maior que 50 MB');
     const original=await readFile(path.join(dir,f.name));const meta=await sharp(original,{limitInputPixels:30000000,failOn:'warning'}).metadata();
     if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)throw new Error('formato de imagem não suportado');
     // Sem recorte. Ajusta EXIF e mantém a proporção, sem ampliar.
     const bytes=await sharp(original,{limitInputPixels:30000000,failOn:'warning'}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
     const caminho=`lancamento/${lote}/${d.codigo}/${String(ordem).padStart(2,'0')}.webp`;
     arquivos.push({caminho,bytes,sha256:sha(bytes),origem:nome});fotos.push({caminho,ordem});
    }catch{erros.push(`Arquivo ${nome}: imagem corrompida, vazia, grande demais ou que não é imagem.`);}
   }
  }
  if(publicar==='sim'&&!fotos.some(f=>f.ordem===1))erros.push(`${label}: peça publicada precisa da foto 01 (capa).`);
  fotos.sort((a,b)=>a.ordem-b.ordem);
  manifesto.push({...d,preco,preco_promocional:promocional,estoque:Number(d.estoque),publicar:publicar==='sim'?'sim':'não',ordem_vitrine:d.ordem_vitrine?Number(d.ordem_vitrine):0,fotos});
 }
 return{erros,manifesto,arquivos,lote};
}
async function rpc(sb,nome,args={}){const r=await sb.rpc(nome,args);if(r.error)throw new Error(r.error.message);return r.data;}
const conferir=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
export async function executarCarga({sb,pasta,backupDir,lote=randomUUID(),apenasValidar=false}){
 const contexto=await rpc(sb,'contexto_carga_oficial');
 const entrada=await validarEntrada(pasta,contexto.categorias??[],lote);
 if(entrada.erros.length||apenasValidar)return{status:entrada.erros.length?'erros_validacao':'validado',erros:entrada.erros,pecas:entrada.manifesto.length};
 if(!backupDir||path.resolve(backupDir)===process.cwd()||path.resolve(backupDir).startsWith(process.cwd()+path.sep))throw new Error('Guarde o backup em diretório privado fora do repositório.');
 const dir=path.join(backupDir,lote);await mkdir(dir,{recursive:false,mode:0o700});
 await writeFile(path.join(dir,'banco.json'),JSON.stringify(contexto.snapshot,null,2),{mode:0o600});
 await writeFile(path.join(dir,'manifesto.json'),JSON.stringify(entrada.manifesto,null,2),{mode:0o600});
 const anteriores=[...new Set((contexto.fotos_anteriores??[]).map(m=>m.caminho_storage))];
 const hashes=[];
 // Todos os bytes antigos são salvos e verificados ANTES de qualquer upload ou UPDATE.
 for(const caminho of anteriores){
  if(!caminho||caminho.startsWith('/')||caminho.includes('..')||caminho.includes('\\'))throw new Error('Caminho de foto anterior inválido.');
  const blob=conferir(await sb.storage.from('produtos-publico').download(caminho));const bytes=Buffer.from(await blob.arrayBuffer());
  const destino=path.join(dir,'fotos',caminho);await mkdir(path.dirname(destino),{recursive:true,mode:0o700});await writeFile(destino,bytes,{mode:0o600});
  const hash=sha(bytes);if(sha(await readFile(destino))!==hash)throw new Error('Backup de foto não confere.');hashes.push({caminho,sha256:hash,bytes:bytes.length});
 }
 await writeFile(path.join(dir,'integridade.json'),JSON.stringify(hashes,null,2),{mode:0o600});
 const enviados=[],staging=[];let commit=false,resultado;
 try{
  for(const f of entrada.arquivos){
   conferir(await sb.storage.from('catalogo-privado').upload(f.caminho,f.bytes,{contentType:'image/webp',upsert:false}));staging.push(f.caminho);
   conferir(await sb.storage.from('catalogo-privado').copy(f.caminho,f.caminho,{destinationBucket:'produtos-publico'}));enviados.push(f.caminho);
   const teste=conferir(await sb.storage.from('produtos-publico').download(f.caminho));if(sha(Buffer.from(await teste.arrayBuffer()))!==f.sha256)throw new Error(`Foto enviada não confere: ${f.origem}`);
  }
  resultado=await rpc(sb,'aplicar_carga_oficial',{p_lote:lote,p_manifesto:entrada.manifesto,p_assinatura:contexto.assinatura,p_backup:dir});commit=true;
 }catch(e){
  // Resposta de rede ambígua pode esconder um commit: consulta idempotente antes de remover arquivos.
  if(enviados.length===entrada.arquivos.length){try{resultado=await rpc(sb,'aplicar_carga_oficial',{p_lote:lote,p_manifesto:entrada.manifesto,p_assinatura:contexto.assinatura,p_backup:dir});commit=true;}catch{}}
  if(!commit){
   const falhas=[];
   if(enviados.length){const r=await sb.storage.from('produtos-publico').remove(enviados);if(r.error)falhas.push('Limpeza de uploads públicos pendente.');}
   if(staging.length){const r=await sb.storage.from('catalogo-privado').remove(staging);if(r.error)falhas.push('Limpeza de staging privado pendente.');}
   throw new Error(`${e.message}${falhas.length?' '+falhas.join(' '):''}`);
  }
 }
 return await retirarFotosAntigas({sb,dir,lote,hashes,resultado});
}
async function retirarFotosAntigas({sb,dir,lote,hashes,resultado}){
 // Somente após commit: preservar cópia privada e retirar o acesso público antigo.
 const pendencias=[];
 for(const {caminho,sha256} of hashes){
  try{
   const bytes=await readFile(path.join(dir,'fotos',caminho));
   if(sha(bytes)!==sha256)throw new Error('O backup local foi alterado.');
   const existente=await sb.storage.from('catalogo-privado').download(`backup/${lote}/${caminho}`);
   if(existente.error)conferir(await sb.storage.from('catalogo-privado').upload(`backup/${lote}/${caminho}`,bytes,{upsert:false}));
   const copia=conferir(await sb.storage.from('catalogo-privado').download(`backup/${lote}/${caminho}`));
   if(sha(Buffer.from(await copia.arrayBuffer()))!==sha(bytes))throw new Error('Cópia privada não confere.');
   conferir(await sb.storage.from('produtos-publico').remove([caminho]));
   const teste=await sb.storage.from('produtos-publico').download(caminho);if(!teste.error)throw new Error('Foto antiga ainda acessível.');
  }catch{pendencias.push(`Retirar foto antiga do acesso público: ${caminho}`);}
 }
 const relatorio={status:pendencias.length?'catalogo_aplicado_retirada_fotos_pendente':'concluido',...resultado,backup:dir,integridade:hashes,pendencias};
 await writeFile(path.join(dir,'resultado.json'),JSON.stringify(relatorio,null,2),{mode:0o600});return relatorio;
}
export async function finalizarCarga({sb,backupDir,lote}){
 if(!/^[0-9a-f-]{36}$/i.test(lote??''))throw new Error('Informe o UUID do lote já aplicado.');
 const dir=path.join(backupDir,lote),manifesto=JSON.parse(await readFile(path.join(dir,'manifesto.json'),'utf8'));
 const hashes=JSON.parse(await readFile(path.join(dir,'integridade.json'),'utf8'));
 // A RPC só retorna um lote aplicado e com manifesto idêntico. Assinatura vazia impede iniciar uma carga nesta recuperação.
 const resultado=await rpc(sb,'aplicar_carga_oficial',{p_lote:lote,p_manifesto:manifesto,p_assinatura:'',p_backup:dir});
 return await retirarFotosAntigas({sb,dir,lote,hashes,resultado});
}
async function cli(){
 const [acao,...args]=process.argv.slice(2),op={};for(let i=0;i<args.length;i+=2)op[args[i]]=args[i+1];
 if(acao==='validar'){
  const cats=JSON.parse(await readFile(op['--categorias'],'utf8'));const r=await validarEntrada(op['--pasta'],cats);console.log(JSON.stringify({erros:r.erros,pecas:r.manifesto.length},null,2));if(r.erros.length)process.exitCode=1;return;
 }
 if(!['aplicar','finalizar','despublicar'].includes(acao))throw new Error('Use validar, aplicar, finalizar ou despublicar. Consulte o registro de lançamento.');
 const creds=JSON.parse(await readFile(op['--credenciais'],'utf8'));
 if(!['https://kernpudxhwkpoadahgqj.supabase.co','http://127.0.0.1:54321','http://localhost:54321'].includes(creds.url)||!creds.publishableKey||!creds.accessToken)throw new Error('Credenciais de admin por senha e projeto aprovado são obrigatórios.');
 const sb=createClient(creds.url,creds.publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${creds.accessToken}`}}});
 const resultado=acao==='despublicar'?{despublicadas:await rpc(sb,'despublicar_carga_oficial',{p_lote:op['--lote']})}:acao==='finalizar'?await finalizarCarga({sb,backupDir:op['--backup-dir'],lote:op['--lote']}):await executarCarga({sb,pasta:op['--pasta'],backupDir:op['--backup-dir'],lote:op['--lote']??randomUUID()});
 console.log(JSON.stringify(resultado,null,2));if(resultado.status&&resultado.status!=='concluido')process.exitCode=1;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))cli().catch(e=>{console.error('Carga interrompida: '+e.message);process.exitCode=1;});
