import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { moeda } from '../Visual';
import { urlDaMidia } from '../catalogo';
import { enviarMidia, operar, pendenciasDaPeca } from './catalogoInterno';
import type { ListaInterna, PecaInterna, VariacaoInterna, MedidaInterna } from './catalogoInterno';
import { validarPrecos } from './precos';

function Campo({nome,children}:{nome:string;children:ReactNode}) {return <label className="field"><span>{nome}</span>{children}</label>;}
export function EditorPeca({inicial,lista,fechar,salvou,operacao=operar}:{inicial:PecaInterna;lista:ListaInterna;fechar:()=>void;salvou:(p:PecaInterna)=>void;operacao?:typeof operar}) {
  const [codigo,setCodigo]=useState(inicial.codigo),[real,setReal]=useState(false);
  const [p,setP]=useState(inicial),[nome,setNome]=useState(inicial.nome??''),[descricao,setDescricao]=useState(inicial.descricao);
  const [preco,setPreco]=useState(inicial.preco?.toString()??''),[promo,setPromo]=useState(inicial.preco_promocional?.toString()??'');
  const [categoria,setCategoria]=useState(inicial.categoria_id??''),[colecao,setColecao]=useState(inicial.colecao_id??'');
  const [modelo,setModelo]=useState(inicial.modelo_veste??''),[vars,setVars]=useState(inicial.variacoes),[medidas,setMedidas]=useState(inicial.medidas);
  const [motivo,setMotivo]=useState(''),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState(''),[mensagem,setMensagem]=useState('');
  const [alterado,setAlterado]=useState(false),[saida,setSaida]=useState(false),[tentouPublicar,setTentouPublicar]=useState(false);
  const [categorias,setCategorias]=useState(lista.categorias),[novaCategoria,setNovaCategoria]=useState(''),[reuso,setReuso]=useState(''),[padrao,setPadrao]=useState<Record<string,string>>({});
  useEffect(()=>{setPadrao(categorias.find(c=>c.id===categoria)?.embalagem_padrao??{});},[categoria]);
  const [peso,setPeso]=useState(inicial.peso_g?.toString()??''),[largura,setLargura]=useState(inicial.largura_dobrada_cm?.toString()??''),[altura,setAltura]=useState(inicial.altura_dobrada_cm?.toString()??''),[comprimento,setComprimento]=useState(inicial.comprimento_dobrado_cm?.toString()??'');
  const aviso=useRef<HTMLParagraphElement>(null), adicionarVariacao=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(erro)aviso.current?.focus();},[erro]);
  function mexeu(){setAlterado(true);setMensagem('');setErro('');}
  function aceitar(nova:PecaInterna){setP(nova);salvou(nova);}
  function mudarVar(i:number,campos:Partial<VariacaoInterna>){setVars(v=>v.map((x,j)=>i===j?{...x,...campos}:x));mexeu();}
  function mudarMedida(i:number,campos:Partial<MedidaInterna>){setMedidas(v=>v.map((x,j)=>i===j?{...x,...campos}:x));mexeu();}
  async function executar(acao:()=>Promise<void>){setOcupado(true);setErro('');setMensagem('');try{await acao();}catch(e){setErro(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setOcupado(false);}}
  async function salvarDados(){
    const precos=validarPrecos(preco,promo);
    const nova=await operacao<PecaInterna>('salvar',p.id,{atualizado_em:p.atualizado_em,codigo,confirmar_real:real,nome,descricao,categoria_id:categoria,colecao_id:colecao,
      ...precos,modelo_veste:modelo,variacoes:vars,medidas,motivo_estoque:motivo,peso_g:peso,largura_dobrada_cm:largura.replace(',','.'),altura_dobrada_cm:altura.replace(',','.'),comprimento_dobrado_cm:comprimento.replace(',','.')});
    aceitar(nova);setCodigo(nova.codigo);setReal(false);setVars(nova.variacoes);setMedidas(nova.medidas);setAlterado(false);setMotivo('');return nova;
  }
  async function salvar(e:FormEvent){e.preventDefault();await executar(async()=>{await salvarDados();setMensagem('Alterações salvas.');});}
  async function mudarStatus(acao:string){await executar(async()=>{
    if(acao==='publicar')setTentouPublicar(true);
    const atual=alterado||p.variacoes.length===0?await salvarDados():p;
    const faltando=pendenciasDaPeca(atual);
    if(acao==='publicar'&&faltando.length)throw new Error(`Para publicar, preencha: ${faltando.join(', ')}.`);
    const nova=await operacao<PecaInterna>(acao,atual.id,{atualizado_em:atual.atualizado_em});aceitar(nova);setMensagem(acao==='publicar'?'Peça publicada na vitrine.':'Peça retirada da vitrine e salva como rascunho.');
  });}
  async function criarCategoria(){await executar(async()=>{const c=await operacao<{id:string;nome:string}>('categoria_criar',null,{nome:novaCategoria});setCategorias(cs=>[...cs,c]);setCategoria(c.id);setNovaCategoria('');mexeu();setMensagem('Categoria criada.');});}
  async function reaproveitar(){await executar(async()=>{const outra=await operacao<PecaInterna>('criar',crypto.randomUUID(),{codigo:reuso.toUpperCase().trim(),preparar_real:true});if(!p.nome&&p.preco===null&&!p.midias.length)await operacao('arquivar',p.id);aceitar(outra);});}
  async function moverMidia(id:string,passo:number){await executar(async()=>{const ids=p.midias.filter(m=>m.ativo).map((m,i,midias)=>m.id),i=ids.indexOf(id);if(i<0||i+passo<0||i+passo>=ids.length)return;[ids[i],ids[i+passo]]=[ids[i+passo],ids[i]];aceitar(await operacao<PecaInterna>('midia_ordenar',p.id,{ids,atualizado_em:p.atualizado_em}));});}
  async function arquivos(files:FileList|null){if(!files?.length)return;await executar(async()=>{
    let atual=p;let enviados=0;
    try{for(const f of Array.from(files)){atual=await enviarMidia(atual,f);enviados++;aceitar(atual);}}
    catch(e){throw new Error(`${enviados} arquivo(s) enviado(s). ${e instanceof Error?e.message:'Falha no envio.'}`);}
    setMensagem(`${enviados} arquivo(s) enviado(s).`);
  });}
  const faltas=pendenciasDaPeca(p);
  const faltasAmigaveis=faltas.map(f=>f==='variação e quantidade'?'tamanho, cor e quantidade':f);
  return <section className="editor-peca" aria-label={`Editar ${p.codigo}`}>
    <div className="editor-top"><div><span className="eyebrow">{p.codigo} · {p.status_catalogo==='rascunho'?'RASCUNHO':'PUBLICADO'}</span><h2>{p.nome??p.nome_sugerido??'Peça para revisar'}</h2></div>
      <button className="btn btn-s btn-sm" disabled={ocupado} onClick={()=>alterado?setSaida(true):fechar()}>Voltar ao catálogo</button></div>
    {saida&&<div className="painel-card" role="alertdialog" aria-label="Sair sem salvar?"><h3>Sair sem salvar?</h3><div className="saida-acoes"><button className="btn btn-p" disabled={ocupado} onClick={()=>void executar(async()=>{await salvarDados();fechar();})}>Salvar</button><button className="btn btn-s" disabled={ocupado} onClick={fechar}>Sair sem salvar</button><button className="btn btn-s" onClick={()=>setSaida(false)}>Continuar editando</button></div></div>}
    <div className="editor-colunas"><aside>
      <div className="upload-peca" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!ocupado)void arquivos(e.dataTransfer.files);}}>
        <b>Fotos e vídeos da peça</b><p>Envie fotos da câmera ou da galeria. A primeira foto será a capa.</p>
        <label className="btn btn-s btn-sm">Selecionar arquivos<input className="arquivo-input" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={ocupado} onChange={e=>{void arquivos(e.target.files);e.target.value='';}}/></label>
        <small>JPG, PNG, WebP, MP4 ou WebM · até 50 MB por arquivo</small></div>
      {tentouPublicar&&!p.midias.some(m=>m.ativo&&m.tipo==='foto')&&<p className="erro-campo">Envie pelo menos uma foto para publicar.</p>}<div className="galeria-interna">{p.midias.filter(m=>m.ativo).map((m,i,midias)=><div key={m.id} className="midia-interna">
        {m.tipo==='foto'?<img src={urlDaMidia(m.caminho_storage)??undefined} alt={m.alt_texto} loading="lazy"/>:<video src={urlDaMidia(m.caminho_storage)??undefined} controls preload="metadata"/>}
        <div><span className="pill">{m.principal?'Capa':m.tipo==='video'?'Vídeo':'Foto'}</span>{m.tipo==='foto'&&!m.principal&&<button disabled={ocupado} onClick={()=>executar(async()=>aceitar(await operacao<PecaInterna>('midia_capa',p.id,{midia_id:m.id,atualizado_em:p.atualizado_em})))}>Usar como capa</button>}
          <button aria-label={`Mover foto ${i+1} para antes`} disabled={ocupado||i===0} onClick={()=>void moverMidia(m.id,-1)}>↑ Antes</button><button aria-label={`Mover foto ${i+1} para depois`} disabled={ocupado||i===midias.length-1} onClick={()=>void moverMidia(m.id,1)}>↓ Depois</button>
          <button disabled={ocupado} onClick={()=>{if(window.confirm('Remover esta mídia do cadastro? O arquivo e o histórico serão preservados.'))void executar(async()=>aceitar(await operacao<PecaInterna>('midia_arquivar',p.id,{midia_id:m.id,atualizado_em:p.atualizado_em})));}}>Remover</button></div></div>)}</div>
      {p.midias.length===0&&<p className="small muted">Comece pelas fotos. Você pode preencher os outros dados depois.</p>}
    </aside><form onSubmit={salvar}>
      <div className="painel-card"><h3>Informações da peça</h3><div className="campos-duplos">
        <Campo nome="Nome da peça">{tentouPublicar&&!nome.trim()&&<small className="erro-campo">Informe o nome para publicar.</small>}<input className="input" value={nome} placeholder={p.nome_sugerido??'Definir durante a curadoria'} maxLength={200} onChange={e=>{setNome(e.target.value);mexeu();}}/>{p.nome_sugerido&&!nome&&<button className="small" type="button" onClick={()=>{setNome(p.nome_sugerido!);mexeu();}}>Usar nome sugerido</button>}</Campo>
        <Campo nome="Código"><input className="input" value={codigo} maxLength={80} onChange={e=>{setCodigo(e.target.value.toUpperCase());mexeu();}}/></Campo>
        <Campo nome="Categoria"><select className="input" value={categoria} onChange={e=>{setCategoria(e.target.value);mexeu();}}><option value="">Sem categoria</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        <Campo nome="Nova categoria (opcional)"><input className="input" value={novaCategoria} onChange={e=>setNovaCategoria(e.target.value)}/><button className="btn btn-s btn-sm" type="button" disabled={ocupado||!novaCategoria.trim()} onClick={()=>void criarCategoria()}>Criar categoria</button></Campo><Campo nome="Coleção"><select className="input" value={colecao} onChange={e=>{setColecao(e.target.value);mexeu();}}><option value="">Sem coleção</option>{lista.colecoes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        <Campo nome="Preço de venda (R$)">{tentouPublicar&&!preco.trim()&&<small className="erro-campo">Informe o preço para publicar.</small>}<input className="input" type="text" inputMode="decimal" value={preco} placeholder="Definir depois" onChange={e=>{setPreco(e.target.value);mexeu();}}/></Campo>
        <Campo nome="Preço promocional (R$)"><input className="input" type="text" inputMode="decimal" value={promo} placeholder="Opcional" aria-describedby="ajuda-promocao" onChange={e=>{setPromo(e.target.value);mexeu();}}/><small id="ajuda-promocao">Opcional. Deve ser menor que o preço de venda; deixe vazio para vender pelo preço normal.</small></Campo>
      </div>{p.observacoes_curadoria&&<p className="small muted">Curadoria: {p.observacoes_curadoria}</p>}<Campo nome="Descrição"><textarea className="input" rows={4} value={descricao} placeholder="Tecido, detalhes e caimento…" onChange={e=>{setDescricao(e.target.value);mexeu();}}/></Campo>
      <Campo nome="A modelo veste"><input className="input" value={modelo} placeholder="Opcional" onChange={e=>{setModelo(e.target.value);mexeu();}}/></Campo></div>
      <div className="painel-card"><div className="secao-acao"><h3>Tamanhos, cores e estoque</h3><button ref={adicionarVariacao} type="button" className="btn btn-s btn-sm" disabled={ocupado} onClick={()=>{setVars(v=>[...v,{id:crypto.randomUUID(),sku:'',tamanho:'',cor:'',quantidade:1,ativo:true}]);mexeu();}}>+ Variação</button></div>
        <p className="small muted">Cor e tamanho são opcionais. Sem variações, o sistema cria uma padrão com estoque 1 ao salvar.</p><datalist id="tamanhos-rapidos"><option value="Tamanho único"/><option value="P"/><option value="M"/><option value="G"/><option value="GG"/></datalist>
        {vars.map((v,i)=><div key={v.id} className={`linha-variacao ${!v.ativo?'linha-inativa':''}`}>
          <Campo nome="Tamanho"><input className="input" value={v.tamanho} list="tamanhos-rapidos" onChange={e=>mudarVar(i,{tamanho:e.target.value})}/></Campo>
          <Campo nome="Cor"><input className="input" value={v.cor} onChange={e=>mudarVar(i,{cor:e.target.value})}/></Campo>
          <Campo nome="Quantidade"><input className="input" type="number" min="0" step="1" value={v.quantidade} onChange={e=>mudarVar(i,{quantidade:e.target.value})}/></Campo>
          <button type="button" className="btn btn-s btn-sm" onClick={()=>{if(!v.sku){setVars(vs=>vs.filter(x=>x.id!==v.id));mexeu();}else mudarVar(i,{ativo:!v.ativo});}}>{v.ativo?'Desativar':'Reativar'}</button>
          <small className="sku-interno">{v.sku||'SKU será gerado ao salvar'}</small></div>)}
        <Campo nome="Motivo do ajuste de quantidade"><input className="input" value={motivo} placeholder="Ex.: conferência das peças para o lançamento" onChange={e=>setMotivo(e.target.value)}/></Campo></div>
      <div className="painel-card"><div className="secao-acao"><h3>Medidas por tamanho</h3><button type="button" className="btn btn-s btn-sm" onClick={()=>{setMedidas(v=>[...v,{id:crypto.randomUUID(),tamanho:'',medida:'busto',rotulo:'Busto',valor_cm:'',ativo:true}]);mexeu();}}>+ Medida</button></div>
        <p className="small muted">Preencha quando tiver as medidas. O sistema não estima medidas pelas fotos.</p>
        {medidas.map((m,i)=><div key={m.id} className={`linha-medida ${!m.ativo?'linha-inativa':''}`}>
          <Campo nome="Tamanho"><input className="input" value={m.tamanho} required onChange={e=>mudarMedida(i,{tamanho:e.target.value})}/></Campo>
          <Campo nome="Medida"><select className="input" value={m.medida} onChange={e=>mudarMedida(i,{medida:e.target.value,rotulo:e.target.options[e.target.selectedIndex].text})}>{[['busto','Busto'],['cintura','Cintura'],['quadril','Quadril'],['comprimento','Comprimento'],['manga','Manga'],['ombro','Ombro'],['outra','Outra']].map(([id,nome])=><option key={id} value={id}>{nome}</option>)}</select></Campo>
          {m.medida==='outra'&&<Campo nome="Nome da medida"><input className="input" value={m.rotulo} required onChange={e=>mudarMedida(i,{rotulo:e.target.value})}/></Campo>}
          <Campo nome="Valor (cm)"><input className="input" type="number" min="0.01" step="0.01" value={m.valor_cm} required onChange={e=>mudarMedida(i,{valor_cm:e.target.value})}/></Campo>
          <button type="button" className="btn btn-s btn-sm" onClick={()=>{if(!inicial.medidas.some(x=>x.id===m.id)){setMedidas(ms=>ms.filter(x=>x.id!==m.id));mexeu();}else mudarMedida(i,{ativo:!m.ativo});}}>{m.ativo?'Desativar':'Reativar'}</button></div>)}</div>
      {p.dado_teste&&p.codigo!=='SMOKE-01'&&<label className="painel-card small"><input type="checkbox" checked={real} onChange={e=>{setReal(e.target.checked);mexeu();}}/> Conferi os dados, fotos e estoque reais desta peça. Ao salvar, retirar a marcação de teste.</label>}
      <div className="editor-acoes"><button className="btn btn-p" type="submit" disabled={ocupado}>{ocupado?'Salvando…':'Salvar alterações'}</button>
        {p.ativo?<button type="button" className="btn btn-s" disabled={ocupado} onClick={()=>mudarStatus('rascunho')}>Retirar da vitrine</button>:<button type="button" className="btn btn-s" disabled={ocupado} onClick={()=>mudarStatus('publicar')}>Publicar na vitrine</button>}
      </div>
      {mensagem&&<p className="painel-sucesso" role="status">{mensagem}</p>}{erro&&<p ref={aviso} className="painel-erro" role="alert" tabIndex={-1}>{erro}</p>}
      <details className="painel-card"><summary>Opções adicionais</summary>
      <Campo nome="Reaproveitar código de teste ou arquivado"><input className="input" value={reuso} onChange={e=>setReuso(e.target.value)}/></Campo><button className="btn btn-s" type="button" disabled={ocupado||!reuso.trim()} onClick={()=>void reaproveitar()}>Abrir código para dados reais</button>
      <h3>Embalagem da peça (opcional)</h3><p className="small">Deixe vazio para usar o padrão da categoria quando a cotação de frete for integrada.</p><div className="campos-duplos">{[['Peso (g)',peso,setPeso],['Largura (cm)',largura,setLargura],['Altura (cm)',altura,setAltura],['Comprimento (cm)',comprimento,setComprimento]].map(([n,v,set])=><Campo key={n as string} nome={n as string}><input className="input" type="text" inputMode="decimal" value={v as string} onChange={e=>{(set as (v:string)=>void)(e.target.value);mexeu();}}/></Campo>)}</div>
      {categoria&&<><h3>Padrão de embalagem da categoria</h3><div className="campos-duplos">{[['peso_g','Peso padrão (g)'],['largura_cm','Largura padrão (cm)'],['altura_cm','Altura padrão (cm)'],['comprimento_cm','Comprimento padrão (cm)']].map(([k,n])=><Campo key={k} nome={n}><input className="input" inputMode="decimal" value={padrao[k]??''} onChange={e=>setPadrao(x=>({...x,[k]:e.target.value.replace(',','.')}))}/></Campo>)}</div><button className="btn btn-s" type="button" disabled={ocupado} onClick={()=>void executar(async()=>{await operacao('categoria_embalagem',categoria,{embalagem:padrao});setCategorias(cs=>cs.map(c=>c.id===categoria?{...c,embalagem_padrao:padrao}:c));setMensagem('Padrão da categoria salvo.');})}>Salvar padrão da categoria</button></>}
      <button className="btn btn-s" type="button" disabled={ocupado} onClick={()=>void executar(async()=>{await operacao('arquivar',p.id,{atualizado_em:p.atualizado_em});fechar();})}>Arquivar peça</button></details>
    </form></div>
  </section>;
}
