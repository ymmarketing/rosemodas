import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Loja } from './Loja';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz ausente.');
createRoot(root).render(<StrictMode><Loja /></StrictMode>);
