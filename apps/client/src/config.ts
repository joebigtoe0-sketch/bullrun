export interface RuntimeConfig {
  apiUrl: string;
  wsUrl: string;
  solanaRpc: string;
}

declare global {
  interface Window {
    __BULLRACE_CONFIG__?: Partial<RuntimeConfig>;
  }
}

let config: RuntimeConfig | null = null;

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function fromPartial(data: Partial<RuntimeConfig> | undefined): RuntimeConfig | null {
  if (!data?.apiUrl) return null;
  return {
    apiUrl: normalizeUrl(data.apiUrl),
    wsUrl: normalizeUrl(data.wsUrl || data.apiUrl),
    solanaRpc: normalizeUrl(data.solanaRpc || 'https://api.mainnet-beta.solana.com'),
  };
}

export async function loadConfig(): Promise<RuntimeConfig> {
  if (config) return config;

  const injected = fromPartial(window.__BULLRACE_CONFIG__);
  if (injected) {
    config = injected;
    return config;
  }

  // Runtime config.json — generated at container start on Railway
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = (await res.json()) as Partial<RuntimeConfig>;
      const runtime = fromPartial(data);
      if (runtime) {
        config = runtime;
        return config;
      }
    }
  } catch {
    // fall through to build-time env
  }

  config = {
    apiUrl: normalizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:3001'),
    wsUrl: normalizeUrl(import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001'),
    solanaRpc: normalizeUrl(import.meta.env.VITE_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'),
  };
  return config;
}

export function getConfig(): RuntimeConfig {
  if (!config) {
    throw new Error('Config not loaded — call loadConfig() first');
  }
  return config;
}
