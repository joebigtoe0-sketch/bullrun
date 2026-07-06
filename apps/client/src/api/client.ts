import type { MeResponse } from '@bullrun/shared';
import { getConfig } from '../config';

function getToken() {
  return localStorage.getItem('bullrun.token');
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const err = JSON.parse(text) as { error?: string };
    return err.error || res.statusText;
  } catch {
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      const api = getConfig().apiUrl;
      return `Got HTML instead of JSON — the client is not reaching the game server. Set API_URL on the client service to your server URL (currently calling ${api}).`;
    }
    return text.slice(0, 120) || res.statusText;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const { apiUrl } = getConfig();
  const token = getToken();
  const res = await fetch(`${apiUrl}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from server at ${apiUrl}${path}`);
  }
}

export const api = {
  register: (username: string, password: string, displayName?: string) =>
    request<{ token: string; user: { id: string; username: string; displayName: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    }),
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: string; username: string; displayName: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<MeResponse>('/me'),
  updatePosition: (x: number, y: number) =>
    request<{ ok: boolean }>('/me/position', { method: 'PATCH', body: JSON.stringify({ x, y }) }),
  train: (bullId: number, stat: string) =>
    request<MeResponse>('/bulls/train', { method: 'POST', body: JSON.stringify({ bullId, stat }) }),
  rest: (bullId: number) =>
    request<MeResponse>('/bulls/rest', { method: 'POST', body: JSON.stringify({ bullId }) }),
  rename: (bullId: number, name: string) =>
    request<MeResponse>('/bulls/rename', { method: 'POST', body: JSON.stringify({ bullId, name }) }),
  breed: (bullAId: number, bullBId: number) =>
    request<MeResponse>('/bulls/breed', { method: 'POST', body: JSON.stringify({ bullAId, bullBId }) }),
  upgradeStable: () => request<MeResponse>('/stable/upgrade', { method: 'POST', body: '{}' }),
  forge: (oreAmount: number) =>
    request<{ me: MeResponse; item: { name: string; rarity: string } }>('/forge', { method: 'POST', body: JSON.stringify({ oreAmount }) }),
  equip: (itemId: number, bullId: number) =>
    request<MeResponse>('/items/equip', { method: 'POST', body: JSON.stringify({ itemId, bullId }) }),
  unequip: (itemId: number) =>
    request<MeResponse>('/items/unequip', { method: 'POST', body: JSON.stringify({ itemId }) }),
  deleteBull: (bullId: number) =>
    request<MeResponse>('/bulls/delete', { method: 'POST', body: JSON.stringify({ bullId }) }),
  followBull: (bullId: number) =>
    request<MeResponse>('/bulls/follow', { method: 'POST', body: JSON.stringify({ bullId }) }),
  depositBullStable: (bullId: number) =>
    request<MeResponse>('/bulls/to-stable', { method: 'POST', body: JSON.stringify({ bullId }) }),
  depositBullDen: (bullId: number, plotId: number) =>
    request<{ me: MeResponse; pastures: import('@bullrun/shared').PasturePlotState[] }>('/bulls/to-den', { method: 'POST', body: JSON.stringify({ bullId, plotId }) }),
  gatherComplete: (nodeId: string, x?: number, y?: number) =>
    request<{ qty: number; mat: string; me: MeResponse }>('/gather/complete', { method: 'POST', body: JSON.stringify({ nodeId, x, y }) }),
  enterRace: (bullId: number, x?: number, y?: number) =>
    request<MeResponse>('/race/enter', { method: 'POST', body: JSON.stringify({ bullId, x, y }) }),
  placeBet: (targetBullId: string, targetName: string, amount: number, odds: number, x?: number, y?: number) =>
    request<MeResponse>('/race/bet', { method: 'POST', body: JSON.stringify({ targetBullId, targetName, amount, odds, x, y }) }),
  raceOdds: () => request<{ field: unknown[]; odds: number[] }>('/race/odds'),
  listMaterial: (mat: string, pricePerUnit: number, qty: number) =>
    request<MeResponse>('/market/list', { method: 'POST', body: JSON.stringify({ mat, pricePerUnit, qty }) }),
  listBull: (bullId: number, price: number) =>
    request<MeResponse>('/market/list-bull', { method: 'POST', body: JSON.stringify({ bullId, price }) }),
  cancelBullListing: (listingId: string) =>
    request<MeResponse>('/market/cancel-bull', { method: 'POST', body: JSON.stringify({ listingId }) }),
  market: () => request<unknown[]>('/market'),
  buyListing: (listingId: string) =>
    request<MeResponse>('/market/buy', { method: 'POST', body: JSON.stringify({ listingId }) }),
  buyNpc: (mat: string, price: number) =>
    request<MeResponse>('/market/buy-npc', { method: 'POST', body: JSON.stringify({ mat, price }) }),
  buyShopBull: (bull: Record<string, unknown>, price: number) =>
    request<MeResponse>('/market/buy-bull', { method: 'POST', body: JSON.stringify({ bull, price }) }),
  settings: (data: Record<string, unknown>) =>
    request<MeResponse>('/me/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  pastures: () => request<import('@bullrun/shared').PasturePlotState[]>('/pastures'),
  buyPasture: (id: number) =>
    request<{ me: MeResponse; pastures: import('@bullrun/shared').PasturePlotState[] }>(`/pastures/${id}/buy`, { method: 'POST', body: '{}' }),
  upgradePasture: (id: number) =>
    request<{ me: MeResponse; pastures: import('@bullrun/shared').PasturePlotState[]; woodToNext: number }>(`/pastures/${id}/upgrade`, { method: 'POST', body: '{}' }),
};

export function saveToken(token: string) {
  localStorage.setItem('bullrun.token', token);
}

export function clearToken() {
  localStorage.removeItem('bullrun.token');
}

export function getWsUrl(): string {
  return getConfig().wsUrl;
}
