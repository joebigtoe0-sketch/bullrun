import './polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadConfig } from './config';
import { WalletProviders } from './providers/WalletProviders';
import './styles.css';

async function boot() {
  try {
    await loadConfig();
  } catch (err) {
    console.error('Failed to load config', err);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <WalletProviders>
        <App />
      </WalletProviders>
    </StrictMode>
  );
}

void boot();
