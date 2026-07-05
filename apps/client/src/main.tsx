import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadConfig } from './config';
import './styles.css';

async function boot() {
  try {
    await loadConfig();
  } catch (err) {
    console.error('Failed to load config', err);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void boot();
