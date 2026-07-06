import type { Server as SocketServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type { WorldNode } from '@prisma/client';
import { prisma } from '../db.js';
import { updatePosition } from '../services/player.js';
import { listPastures } from '../services/pasture.js';
import { CHAT_MAX_LEN, type ChatMessage, type OtherPlayer, type OtherPlayerBull } from '@bullrun/shared';

type OnlinePlayer = {
  socketId: string;
  username: string;
  displayName: string;
  x: number;
  y: number;
  stableLevel: number;
  shirt: string;
  bulls: OtherPlayerBull[];
};

const onlinePlayers = new Map<string, OnlinePlayer>();
let ioRef: SocketServer | null = null;

async function loadBullsForUser(userId: string): Promise<OtherPlayerBull[]> {
  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  const ids = profile?.followingBullIds ?? [];
  if (!ids.length) return [];
  const bulls = await prisma.bull.findMany({
    where: { ownerId: userId, id: { in: ids }, location: 'following' },
  });
  return bulls.map((b) => ({
    id: b.id,
    name: b.name,
    coat: b.coat,
    trait: (b.trait as OtherPlayerBull['trait']) || 'normal',
  }));
}

function toPresence(id: string, p: OnlinePlayer): OtherPlayer {
  return {
    id,
    username: p.username,
    displayName: p.displayName,
    x: p.x,
    y: p.y,
    stableLevel: p.stableLevel,
    shirt: p.shirt,
    bulls: p.bulls,
  };
}

export function setupSocket(io: SocketServer, app: FastifyInstance) {
  ioRef = io;
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      if (!token) return next(new Error('No token'));
      const decoded = app.jwt.verify<{ sub: string }>(token);
      socket.data.userId = decoded.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user?.profile) {
      socket.disconnect();
      return;
    }

    const bulls = await loadBullsForUser(userId);

    const player: OnlinePlayer = {
      socketId: socket.id,
      username: user.username,
      displayName: user.displayName,
      x: user.profile.posX,
      y: user.profile.posY,
      stableLevel: user.profile.stableLevel,
      shirt: '#e8a33d',
      bulls,
    };

    onlinePlayers.set(userId, player);

    const nodes = await prisma.worldNode.findMany();
    const pastures = await listPastures();
    const race = await prisma.race.findFirst({
      where: { status: { in: ['scheduled', 'running'] } },
      orderBy: { startAt: 'asc' },
    });

    socket.emit('world_snapshot', {
      players: [...onlinePlayers.entries()]
        .filter(([id]) => id !== userId)
        .map(([id, p]) => toPresence(id, p)),
      nodes: nodes.map((n: WorldNode) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        mat: n.mat,
        deadUntil: n.deadUntil?.getTime() ?? null,
      })),
      pastures,
      race: race
        ? { id: race.id, status: race.status, startAt: race.startAt.getTime(), field: race.field }
        : null,
    });

    socket.broadcast.emit('player_joined', toPresence(userId, player));

    socket.on('move', async ({ x, y }: { x: number; y: number }) => {
      const p = onlinePlayers.get(userId);
      if (p) {
        p.x = x;
        p.y = y;
        await updatePosition(userId, x, y);
        socket.broadcast.emit('player_moved', { id: userId, x, y });
      }
    });

    socket.on('chat', ({ text }: { text: string }) => {
      const p = onlinePlayers.get(userId);
      if (!p || !ioRef) return;
      const msg = String(text ?? '').trim().slice(0, CHAT_MAX_LEN);
      if (!msg) return;
      const payload: ChatMessage = {
        id: userId,
        displayName: p.displayName,
        text: msg,
        at: Date.now(),
      };
      ioRef.emit('chat_message', payload);
    });

    socket.on('disconnect', () => {
      onlinePlayers.delete(userId);
      io.emit('player_left', { id: userId });
    });
  });
}

export function getOnlineCount() {
  return onlinePlayers.size;
}

export async function refreshPlayerBulls(userId: string): Promise<OtherPlayerBull[] | null> {
  const p = onlinePlayers.get(userId);
  if (!p) return null;
  p.bulls = await loadBullsForUser(userId);
  return p.bulls;
}

export async function broadcastPlayerBulls(userId: string): Promise<OtherPlayerBull[] | null> {
  const bulls = await refreshPlayerBulls(userId);
  if (bulls && ioRef) {
    ioRef.emit('player_bulls_updated', { id: userId, bulls });
  }
  return bulls;
}
