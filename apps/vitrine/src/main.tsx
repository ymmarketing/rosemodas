import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz ausente.');

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Rose Modas</h1>
      <p>Ambiente de desenvolvimento preparado.</p>
      <p>A vitrine será implementada na próxima etapa aprovada.</p>
    </main>
  </StrictMode>,
);
