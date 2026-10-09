import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {Loja} from '../apps/vitrine/src/Loja';
const w=window as any;w.IS_REACT_ACT_ENVIRONMENT=true;
w.testeLoja={act,montar(){const root=createRoot(document.getElementById('loja')!);root.render(createElement(Loja,{homologacao:true}));return()=>root.unmount();}};
