import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './net/socket';
import './styles.css';

if (import.meta.env.DEV) {
  const { maybeStartPreview } = await import('./dev/preview');
  maybeStartPreview();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
