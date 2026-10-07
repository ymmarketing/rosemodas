// Executado somente no DOM de testes. Não faz parte do build da aplicação.
import {act, createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {EditorPeca} from '../apps/vitrine/src/painel/EditorPeca';

const contexto=window as any;
contexto.IS_REACT_ACT_ENVIRONMENT=true;
contexto.testeEditor={act,montar(props: any){
  const root=createRoot(document.getElementById('editor')!);
  root.render(createElement(EditorPeca,props));
  return ()=>root.unmount();
}};
