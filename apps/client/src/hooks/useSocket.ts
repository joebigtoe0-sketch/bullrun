import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { CHAT_MAX_LEN } from '@bullrun/shared';
import { getWsUrl, api } from '../api/client';
import { useGameStore } from '../store/gameStore';

export const gameSocketRef = { current: null as Socket | null };

export function emitChat(text: string) {
  const msg = text.trim().slice(0, CHAT_MAX_LEN);
  if (!msg) return;
  gameSocketRef.current?.emit('chat', { text: msg });
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const me = useGameStore((s) => s.me);
  const token = useGameStore((s) => s.token);

  useEffect(() => {
    if (!token || !me) return;

    const socket = io(getWsUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    gameSocketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.error('Socket connect_error', err.message);
      useGameStore.getState().toastMsg(`World sync failed: ${err.message}`);
    });
    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected', reason);
    });

    socket.on('world_snapshot', (data: {
      players: import('@bullrun/shared').OtherPlayer[];
      nodes: { id: string; x: number; y: number; mat: import('@bullrun/shared').MatType; deadUntil: number | null }[];
      pastures: import('@bullrun/shared').PasturePlotState[];
      race: unknown;
    }) => {
      useGameStore.getState().setOtherPlayers(data.players);
      useGameStore.getState().setPastures(data.pastures ?? []);
      useGameStore.getState().setWorldNodes(
        data.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, mat: n.mat })),
      );
      for (const n of data.nodes) {
        if (n.deadUntil) useGameStore.getState().setNodeDead(n.id, n.deadUntil);
      }
    });

    socket.on('player_joined', (p: import('@bullrun/shared').OtherPlayer) => {
      useGameStore.getState().addOtherPlayer(p);
    });
    socket.on('player_left', ({ id }: { id: string }) => {
      useGameStore.getState().removeOtherPlayer(id);
    });
    socket.on('player_moved', ({ id, x, y }: { id: string; x: number; y: number }) => {
      useGameStore.getState().updateOtherPlayer(id, x, y);
    });
    socket.on('node_depleted', ({ id, deadUntil }: { id: string; deadUntil: number }) => {
      useGameStore.getState().setNodeDead(id, deadUntil);
    });
    socket.on('node_respawned', ({ id }: { id: string }) => {
      useGameStore.getState().clearNodeDead(id);
    });
    socket.on('player_bulls_updated', ({ id, bulls }: { id: string; bulls: import('@bullrun/shared').OtherPlayerBull[] }) => {
      const players = useGameStore.getState().otherPlayers.map((p) =>
        p.id === id ? { ...p, bulls } : p,
      );
      useGameStore.getState().setOtherPlayers(players);
    });
    socket.on('pastures_updated', (pastures: import('@bullrun/shared').PasturePlotState[]) => {
      useGameStore.getState().setPastures(pastures);
    });
    socket.on('pasture_spawned', (data: { plotId: number; bull: { name: string; trait?: string } }) => {
      const trait = data.bull.trait && data.bull.trait !== 'normal' ? ` (${data.bull.trait})` : '';
      useGameStore.getState().toastMsg(`New bull in plot ${data.plotId + 1}: ${data.bull.name}${trait}!`);
      api.me().then((m) => { if (m) useGameStore.getState().setMe(m); }).catch(() => {});
    });
    socket.on('race_grid', (data: {
      id: string;
      bulls: Array<{ id: number | string; name: string; coat: string; pos: number; finishT: number; owner?: string; trait?: string }>;
      startAt: number;
      laps: number;
    }) => {
      useGameStore.getState().setRaceGrid({
        ...data,
        bulls: data.bulls.map((b) => ({ ...b, trait: b.trait as import('@bullrun/shared').BullTrait | undefined })),
      });
    });
    socket.on('race_started', (data: {
      id: string;
      bulls: Array<{ id: number | string; name: string; coat: string; pos: number; finishT: number; lapTimes?: number[]; owner?: string; trait?: string }>;
      startT: number;
      endT: number;
      laps?: number;
      elapsed?: number;
    }) => {
      const prev = useGameStore.getState().raceAnim;
      const elapsed = data.elapsed ?? 0;
      if (prev?.id === data.id && !prev.frozen && (prev.elapsedMs ?? 0) > 300) {
        useGameStore.getState().syncRaceClock(data.id, Math.max(elapsed, prev.elapsedMs ?? 0));
        return;
      }
      useGameStore.getState().setRaceGrid(null);
      useGameStore.getState().setRaceAnim({
        ...data,
        bulls: data.bulls.map((b) => ({ ...b, trait: b.trait as import('@bullrun/shared').BullTrait | undefined })),
        elapsedMs: elapsed,
        elapsedAt: Date.now(),
      });
      useGameStore.getState().setRaceLive({ id: data.id, standings: [] });
    });
    socket.on('race_standings', (data: { id: string; standings: { pos: number; name: string; finished: boolean }[]; elapsed?: number }) => {
      useGameStore.getState().setRaceLive(data);
      if (data.elapsed != null) {
        useGameStore.getState().syncRaceClock(data.id, data.elapsed);
      }
    });
    socket.on('race_finished', (data: {
      id: string;
      results: import('@bullrun/shared').RaceResult[];
      betResults: Record<string, string>;
    }) => {
      const userId = useGameStore.getState().user?.id;
      const anim = useGameStore.getState().raceAnim;
      if (anim?.id && anim.id !== data.id) return;
      if (anim) {
        useGameStore.getState().setRaceAnim({ ...anim, frozen: true });
      }
      useGameStore.getState().setRaceGrid(null);
      useGameStore.getState().setRaceLive(null);
      useGameStore.getState().setResults(
        data.results,
        userId ? data.betResults[userId] ?? null : null,
      );
      api.me().then((m) => { if (m) useGameStore.getState().setMe(m); }).catch(() => {});
    });
    socket.on('race_scheduled', (data: {
      id: string;
      startAt: number;
      field: import('@bullrun/shared').NpcBull[];
    }) => {
      const me = useGameStore.getState().me;
      if (!me) return;
      useGameStore.getState().setMe({
        ...me,
        entered: [],
        race: {
          id: data.id,
          status: 'scheduled',
          startAt: new Date(data.startAt).toISOString(),
          field: data.field,
          entered: [],
        },
      });
    });
    socket.on('chat_message', (msg: import('@bullrun/shared').ChatMessage) => {
      useGameStore.getState().addChatMessage(msg);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      gameSocketRef.current = null;
    };
  }, [token, me?.id]);

  const emitMove = useCallback((x: number, y: number) => {
    socketRef.current?.emit('move', { x, y });
  }, []);

  return { emitMove };
}
