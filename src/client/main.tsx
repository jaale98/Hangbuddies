import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './net/socket';
import './styles.css';

let Root = App;
if (import.meta.env.DEV) {
  const { maybeStartPreview } = await import('./dev/preview');
  maybeStartPreview();
  if (new URLSearchParams(location.search).get('preview') === 'gallery') Root = (await import('./dev/Gallery')).Gallery;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
