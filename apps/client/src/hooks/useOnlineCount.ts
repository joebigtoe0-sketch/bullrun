import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function useOnlineCount(enabled = true) {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const load = () => {
      api.getOnline().then((r) => setOnline(r.online)).catch(() => {});
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [enabled]);

  return online;
}
