export interface RuntimeConfig {
  apiUrl: string;
  wsUrl: string;
}

let config: RuntimeConfig | null = null;

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function loadConfig(): Promise<RuntimeConfig> {
  if (config) return config;

  // Runtime config.json — generated at container start on Railway
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as Partial<RuntimeConfig>;
      if (data.apiUrl) {
        config = {
          apiUrl: normalizeUrl(data.apiUrl),
          wsUrl: normalizeUrl(data.wsUrl || data.apiUrl),
        };
        return config;
      }
    }
  } catch {
    // fall through to build-time env
  }

  config = {
    apiUrl: normalizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:3001'),
    wsUrl: normalizeUrl(import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001'),
  };
  return config;
}

export function getConfig(): RuntimeConfig {
  if (!config) {
    throw new Error('Config not loaded — call loadConfig() first');
  }
  return config;
}
