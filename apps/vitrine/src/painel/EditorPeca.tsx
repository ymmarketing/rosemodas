import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { moeda } from '../Visual';
import { urlDaMidia } from '../catalogo';
import { enviarMidia, operar, pendenciasDaPeca } from './catalogoInterno';
import type { ListaInterna, PecaInterna, VariacaoInterna, MedidaInterna } from './catalogoInterno';
import { validarPrecos } from './precos';

function Campo({nome,children}:{nome:string;children:ReactNode}) {return <label className="field"><span>{nome}</span>{children}</label>;}
export function EditorPeca({inicial,lista,fechar,salvou,operacao=operar}:{inicial:PecaInterna;lista:ListaInterna;fechar:()=>void;salvou:(p:PecaInterna)=>void;operacao?:typeof operar}) {
  const [p,setP]=useState(inicial),[nome,setNome]=useState(inicial.nome??''),[descricao,setDescricao]=useState(inicial.descricao);
  const [preco,setPreco]=useState(inicial.preco?.toString()??''),[promo,setPromo]=useState(inicial.preco_promocional?.toString()??'');
  const [categoria,setCategoria]=useState(inicial.categoria_id??''),[colecao,setColecao]=useState(inicial.colecao_id??'');
  const [modelo,setModelo]=useState(inicial.modelo_veste??''),[vars,setVars]=useState(inicial.variacoes),[medidas,setMedidas]=useState(inicial.medidas);
  const [motivo,setMotivo]=useState(''),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState(''),[mensagem,setMensagem]=useState('');
  const [alterado,setAlterado]=useState(false);
  const aviso=useRef<HTMLParagraphElement>(null), adicionarVariacao=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(erro)aviso.current?.focus();},[erro]);
  function mexeu(){setAlterado(true);setMensagem('');setErro('');}
  function aceitar(nova:PecaInterna){setP(nova);salvou(nova);}
  function mudarVar(i:number,campos:Partial<VariacaoInterna>){setVars(v=>v.map((x,j)=>i===j?{...x,...campos}:x));mexeu();}
  function mudarMedida(i:number,campos:Partial<MedidaInterna>){setMedidas(v=>v.map((x,j)=>i===j?{...x,...campos}:x));mexeu();}
  async function executar(acao:()=>Promise<void>){setOcupado(true);setErro('');setMensagem('');try{await acao();}catch(e){setErro(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setOcupado(false);}}
  async function salvar(e:FormEvent){e.preventDefault();await executar(async()=>{
    const precos=validarPrecos(preco,promo);
    const nova=await operacao<PecaInterna>('salvar',p.id,{atualizado_em:p.atualizado_em,nome,descricao,categoria_id:categoria,colecao_id:colecao,
      ...precos,modelo_veste:modelo,variacoes:vars,medidas,motivo_estoque:motivo});
    aceitar(nova);setVars(nova.variacoes);setMedidas(nova.medidas);setAlterado(false);setMotivo('');setMensagem('Alterações salvas.');
  });}
  async function mudarStatus(acao:string){
    if(alterado){setMensagem('');setErro('Salve as alterações antes de '+(acao==='publicar'?'publicar a peça.':'retirar a peça da vitrine.'));return;}
    if(acao==='publicar'&&faltas.length){setMensagem('');setErro(`A peça ainda não foi publicada. Preencha: ${faltasAmigaveis.join(', ')}. Depois salve as alterações e clique em Publicar na vitrine.`);return;}
    await executar(async()=>{const nova=await operacao<PecaInterna>(acao,p.id,{atualizado_em:p.atualizado_em});aceitar(nova);setMensagem(acao==='publicar'?'Peça publicada na vitrine.':'Peça retirada da vitrine e salva como rascunho.');});
  }
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
      <button className="btn btn-s btn-sm" disabled={ocupado} onClick={()=>{if(!alterado||window.confirm('Há alterações ainda não salvas. Fechar mesmo assim?'))fechar();}}>Voltar ao catálogo</button></div>
    <div className="editor-colunas"><aside>
      <div className="upload-peca" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!ocupado)void arquivos(e.dataTransfer.files);}}>
        <b>Fotos e vídeos da peça</b><p>Arraste os arquivos aqui. A primeira foto será a capa.</p>
        <label className="btn btn-s btn-sm">Selecionar arquivos<input className="arquivo-input" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={ocupado} onChange={e=>{void arquivos(e.target.files);e.target.value='';}}/></label>
        <small>JPG, PNG, WebP, MP4 ou WebM · até 50 MB por arquivo</small></div>
      <div className="galeria-interna">{p.midias.filter(m=>m.ativo).map(m=><div key={m.id} className="midia-interna">
        {m.tipo==='foto'?<img src={urlDaMidia(m.caminho_storage)??undefined} alt={m.alt_texto} loading="lazy"/>:<video src={urlDaMidia(m.caminho_storage)??undefined} controls preload="metadata"/>}
        <div><span className="pill">{m.principal?'Capa':m.tipo==='video'?'Vídeo':'Foto'}</span>{m.tipo==='foto'&&!m.principal&&<button disabled={ocupado} onClick={()=>executar(async()=>aceitar(await operar<PecaInterna>('midia_capa',p.id,{midia_id:m.id,atualizado_em:p.atualizado_em})))}>Usar como capa</button>}
          <button disabled={ocupado} onClick={()=>{if(window.confirm('Remover esta mídia do cadastro? O arquivo e o histórico serão preservados.'))void executar(async()=>aceitar(await operar<PecaInterna>('midia_arquivar',p.id,{midia_id:m.id,atualizado_em:p.atualizado_em})));}}>Remover</button></div></div>)}</div>
      {p.midias.length===0&&<p className="small muted">Comece pelas fotos. Você pode preencher os outros dados depois.</p>}
    </aside><form onSubmit={salvar}>
      <div className="painel-card"><h3>Informações da peça</h3><div className="campos-duplos">
        <Campo nome="Nome da peça"><input className="input" value={nome} placeholder={p.nome_sugerido??'Definir durante a curadoria'} maxLength={200} onChange={e=>{setNome(e.target.value);mexeu();}}/>{p.nome_sugerido&&!nome&&<button className="small" type="button" onClick={()=>{setNome(p.nome_sugerido!);mexeu();}}>Usar nome sugerido</button>}</Campo>
        <Campo nome="Código"><input className="input" value={p.codigo} readOnly/></Campo>
        <Campo nome="Categoria"><select className="input" value={categoria} onChange={e=>{setCategoria(e.target.value);mexeu();}}><option value="">Escolher depois</option>{lista.categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        <Campo nome="Coleção"><select className="input" value={colecao} onChange={e=>{setColecao(e.target.value);mexeu();}}><option value="">Sem coleção</option>{lista.colecoes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        <Campo nome="Preço de venda (R$)"><input className="input" type="number" min="0.01" step="0.01" value={preco} placeholder="Definir depois" onChange={e=>{setPreco(e.target.value);mexeu();}}/></Campo>
        <Campo nome="Preço promocional (R$)"><input className="input" type="number" min="0" step="0.01" value={promo} placeholder="Opcional" aria-describedby="ajuda-promocao" onChange={e=>{setPromo(e.target.value);mexeu();}}/><small id="ajuda-promocao">Opcional. Deve ser menor que o preço de venda; deixe vazio para vender pelo preço normal.</small></Campo>
      </div>{p.observacoes_curadoria&&<p className="small muted">Curadoria: {p.observacoes_curadoria}</p>}<Campo nome="Descrição"><textarea className="input" rows={4} value={descricao} placeholder="Tecido, detalhes e caimento…" onChange={e=>{setDescricao(e.target.value);mexeu();}}/></Campo>
      <Campo nome="A modelo veste"><input className="input" value={modelo} placeholder="Opcional" onChange={e=>{setModelo(e.target.value);mexeu();}}/></Campo></div>
      <div className="painel-card"><div className="secao-acao"><h3>Tamanhos, cores e estoque</h3><button ref={adicionarVariacao} type="button" className="btn btn-s btn-sm" disabled={ocupado} onClick={()=>{setVars(v=>[...v,{id:crypto.randomUUID(),sku:'',tamanho:'',cor:'',quantidade:'',ativo:true}]);mexeu();}}>+ Variação</button></div>
        <p className="small muted">Cadastre cada combinação real. O SKU é gerado ao salvar; alterações de quantidade ficam no histórico.</p>
        {vars.length===0&&<p className="painel-pendencia">Falta cadastrar tamanho, cor e quantidade. Clique em <b>+ Variação</b>, preencha os dados reais e salve antes de publicar.</p>}
        {vars.map((v,i)=><div key={v.id} className={`linha-variacao ${!v.ativo?'linha-inativa':''}`}>
          <Campo nome="Tamanho"><input className="input" value={v.tamanho} required={v.ativo} onChange={e=>mudarVar(i,{tamanho:e.target.value})}/></Campo>
          <Campo nome="Cor"><input className="input" value={v.cor} required={v.ativo} onChange={e=>mudarVar(i,{cor:e.target.value})}/></Campo>
          <Campo nome="Quantidade"><input className="input" type="number" min="0" step="1" value={v.quantidade} required onChange={e=>mudarVar(i,{quantidade:e.target.value})}/></Campo>
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
      <div className="editor-acoes"><button className="btn btn-p" type="submit" disabled={ocupado}>{ocupado?'Salvando…':'Salvar alterações'}</button>
        {p.ativo?<button type="button" className="btn btn-s" disabled={ocupado} onClick={()=>mudarStatus('rascunho')}>Retirar da vitrine</button>:<button type="button" className="btn btn-s" disabled={ocupado} onClick={()=>mudarStatus('publicar')}>Publicar na vitrine</button>}
        {alterado&&<p className="small muted">Salve as alterações antes de publicar.</p>}
        {!alterado&&!p.ativo&&<p className="small muted">{faltas.length?`Antes de publicar: ${faltasAmigaveis.join(', ')}.`:'Pronta para publicar após sua revisão.'}</p>}
        {!p.ativo&&faltas.includes('variação e quantidade')&&<button type="button" className="btn btn-s btn-sm" disabled={ocupado} onClick={()=>{adicionarVariacao.current?.scrollIntoView({block:'center',behavior:'smooth'});adicionarVariacao.current?.focus({preventScroll:true});}}>Preencher tamanho, cor e quantidade ↑</button>}
        {p.preco!==null&&<span className="small">Preço salvo: {moeda(p.preco_promocional??p.preco)}</span>}
        {mensagem&&<p className="painel-sucesso" role="status">{mensagem}</p>}{erro&&<p ref={aviso} className="painel-erro" role="alert" tabIndex={-1}>{erro}</p>}
      </div>
    </form></div>
  </section>;
}
