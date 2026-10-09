// Exclusivo de testes; não integra a aplicação nem cria usuários reais.
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {FormularioSenha} from '../apps/vitrine/src/auth/FormularioSenha';
import {Acesso} from '../apps/vitrine/src/painel/Acesso';
const contexto=window as any;
contexto.IS_REACT_ACT_ENVIRONMENT=true;
contexto.testeAuth={act,montar(componente:string,props:any){const root=createRoot(document.getElementById('teste')!);root.render(createElement(componente==='painel'?Acesso:FormularioSenha,props));return()=>root.unmount();}};
