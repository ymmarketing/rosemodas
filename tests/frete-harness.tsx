import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {PaginaProduto} from '../apps/vitrine/src/Produto';
import {ConfiguracoesFrete} from '../apps/vitrine/src/painel/ConfiguracoesFrete';
import {CalculadoraFrete} from '../apps/vitrine/src/CalculadoraFrete';
import {lembrarCep,trechoFreteWhatsApp} from '../apps/vitrine/src/frete';
(window as any).IS_REACT_ACT_ENVIRONMENT=true;
(window as any).testeFrete={act,lembrarCep,trechoFreteWhatsApp,montarPainel(){const root=createRoot(document.getElementById('teste')!);root.render(<ConfiguracoesFrete/>);return()=>root.unmount();},montarPagina(props:any){const root=createRoot(document.getElementById('teste')!);root.render(<PaginaProduto {...props}/>);return()=>root.unmount();},montarCalculadora(props:any){const root=createRoot(document.getElementById('teste')!);root.render(<CalculadoraFrete {...props}/>);return{alterar(props:any){root.render(<CalculadoraFrete {...props}/>);},sair(){root.unmount();}};}};
