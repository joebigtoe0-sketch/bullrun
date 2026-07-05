import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWsUrl } from '../api/client';
import { useGameStore } from '../store/gameStore';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const token = useGameStore((s) => s.token);

  useEffect(() => {
    if (!token) return;

    const socket = io(getWsUrl(), { auth: { token } });
    socketRef.current = socket;

    socket.on('world_snapshot', (data: {
      players: import('@bullrun/shared').OtherPlayer[];
      nodes: { id: string; deadUntil: number | null }[];
      race: unknown;
    }) => {
      useGameStore.getState().setOtherPlayers(data.players);
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
    socket.on('race_started', (data: {
      id: string;
      bulls: Array<{ id: number | string; name: string; coat: string; pos: number; finishT: number }>;
      startT: number;
      endT: number;
    }) => {
      useGameStore.getState().setRaceAnim(data);
      useGameStore.getState().setRaceLive({ id: data.id, standings: [] });
    });
    socket.on('race_standings', (data: { id: string; standings: { pos: number; name: string }[] }) => {
      useGameStore.getState().setRaceLive(data);
    });
    socket.on('race_finished', (data: {
      id: string;
      results: import('@bullrun/shared').RaceResult[];
      betResults: Record<string, string>;
    }) => {
      const userId = useGameStore.getState().user?.id;
      useGameStore.getState().setRaceAnim(null);
      useGameStore.getState().setRaceLive(null);
      useGameStore.getState().setResults(data.results, userId ? data.betResults[userId] ?? null : null);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return {
    emitMove: (x: number, y: number) => socketRef.current?.emit('move', { x, y }),
  };
}
