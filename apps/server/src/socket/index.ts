import type { Server as SocketServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type { WorldNode } from '@prisma/client';
import { prisma } from '../db.js';
import { updatePosition } from '../services/player.js';

const onlinePlayers = new Map<string, { socketId: string; username: string; displayName: string; x: number; y: number; stableLevel: number }>();

export function setupSocket(io: SocketServer, app: FastifyInstance) {
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

    const player = {
      id: userId,
      username: user.username,
      displayName: user.displayName,
      x: user.profile.posX,
      y: user.profile.posY,
      stableLevel: user.profile.stableLevel,
      shirt: '#e8a33d',
    };

    onlinePlayers.set(userId, { socketId: socket.id, ...player });

    const nodes = await prisma.worldNode.findMany();
    const race = await prisma.race.findFirst({
      where: { status: { in: ['scheduled', 'running'] } },
      orderBy: { startAt: 'asc' },
    });

    socket.emit('world_snapshot', {
      players: [...onlinePlayers.entries()]
        .filter(([id]) => id !== userId)
        .map(([id, p]) => ({
          id,
          username: p.username,
          displayName: p.displayName,
          x: p.x,
          y: p.y,
          stableLevel: p.stableLevel,
          shirt: '#e8a33d',
        })),
      nodes: nodes.map((n: WorldNode) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        mat: n.mat,
        deadUntil: n.deadUntil?.getTime() ?? null,
      })),
      race: race
        ? { id: race.id, status: race.status, startAt: race.startAt.getTime(), field: race.field }
        : null,
    });

    socket.broadcast.emit('player_joined', player);

    socket.on('move', async ({ x, y }: { x: number; y: number }) => {
      const p = onlinePlayers.get(userId);
      if (p) {
        p.x = x;
        p.y = y;
        await updatePosition(userId, x, y);
        socket.broadcast.emit('player_moved', { id: userId, x, y });
      }
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
