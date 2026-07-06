import type { Server as SocketServer } from 'socket.io';
import {
  PASTURE_PLOTS,
  PASTURE_WOOD_UPGRADE_COST,
  PASTURE_WOOD_PER_LEVEL,
  pastureSpawnIntervalMs,
  pastureWoodToNextLevel,
  rollPastureBull,
  type PasturePlotState,
  type PastureDisplayBull,
} from '@bullrun/shared';
import { prisma } from '../db.js';
import { getMeResponse } from './player.js';
import { refreshPlayerBulls } from '../socket/index.js';

let io: SocketServer | null = null;

export function setPastureIo(server: SocketServer) {
  io = server;
}

function broadcast(event: string, data: unknown) {
  io?.emit(event, data);
}

export async function initPasturePlots() {
  for (const plot of PASTURE_PLOTS) {
    await prisma.pasturePlot.upsert({
      where: { id: plot.id },
      create: { id: plot.id },
      update: {},
    });
  }
}

function mapPlot(
  row: {
    id: number;
    ownerId: string | null;
    level: number;
    woodInvested: number;
    displayBull: unknown;
    owner?: { displayName: string } | null;
  },
): PasturePlotState {
  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerName: row.owner?.displayName ?? null,
    level: row.level,
    woodInvested: row.woodInvested,
    displayBull: (row.displayBull as PastureDisplayBull | null) ?? null,
  };
}

export async function listPastures(): Promise<PasturePlotState[]> {
  const rows = await prisma.pasturePlot.findMany({
    include: { owner: true },
    orderBy: { id: 'asc' },
  });
  return rows.map(mapPlot);
}

export async function buyPasture(userId: string, plotId: number) {
  const def = PASTURE_PLOTS.find((p) => p.id === plotId);
  if (!def) throw new Error('Plot not found');

  const plot = await prisma.pasturePlot.findUnique({ where: { id: plotId } });
  if (!plot) throw new Error('Plot not found');
  if (plot.ownerId) throw new Error('Plot already owned');

  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');
  if (profile.gold < def.price) throw new Error(`Need ${def.price}g`);

  const nextSpawnAt = new Date(Date.now() + pastureSpawnIntervalMs(1));

  await prisma.$transaction([
    prisma.playerProfile.update({
      where: { userId },
      data: { gold: profile.gold - def.price },
    }),
    prisma.pasturePlot.update({
      where: { id: plotId },
      data: { ownerId: userId, level: 1, woodInvested: 0, nextSpawnAt },
    }),
  ]);

  const pastures = await listPastures();
  broadcast('pastures_updated', pastures);
  return { me: await getMeResponse(userId), pastures };
}

export async function upgradePasture(userId: string, plotId: number) {
  const plot = await prisma.pasturePlot.findUnique({ where: { id: plotId } });
  if (!plot) throw new Error('Plot not found');
  if (plot.ownerId !== userId) throw new Error('Not your plot');

  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');
  if (profile.wood < PASTURE_WOOD_UPGRADE_COST) throw new Error(`Need ${PASTURE_WOOD_UPGRADE_COST} wood`);

  let level = plot.level;
  let woodInvested = plot.woodInvested + PASTURE_WOOD_UPGRADE_COST;
  while (woodInvested >= PASTURE_WOOD_PER_LEVEL * level) {
    woodInvested -= PASTURE_WOOD_PER_LEVEL * level;
    level += 1;
  }

  await prisma.$transaction([
    prisma.playerProfile.update({
      where: { userId },
      data: { wood: profile.wood - PASTURE_WOOD_UPGRADE_COST },
    }),
    prisma.pasturePlot.update({
      where: { id: plotId },
      data: { level, woodInvested },
    }),
  ]);

  const pastures = await listPastures();
  broadcast('pastures_updated', pastures);
  return {
    me: await getMeResponse(userId),
    pastures,
    woodToNext: pastureWoodToNextLevel(level, woodInvested),
  };
}

async function spawnOnPlot(plotId: number) {
  const plot = await prisma.pasturePlot.findUnique({
    where: { id: plotId },
    include: { owner: true },
  });
  if (!plot?.ownerId) return;

  const profile = await prisma.playerProfile.findUnique({ where: { userId: plot.ownerId } });
  if (!profile) return;

  const rolled = rollPastureBull(Date.now() + plotId * 997);
  const bull = await prisma.bull.create({
    data: {
      ownerId: plot.ownerId,
      name: rolled.name,
      speed: rolled.speed,
      stamina: rolled.stamina,
      accel: rolled.accel,
      temper: rolled.temper,
      coat: rolled.coat,
      trait: rolled.trait,
    },
  });

  const displayBull: PastureDisplayBull = {
    id: bull.id,
    name: bull.name,
    coat: bull.coat,
    trait: rolled.trait,
  };

  const nextSpawnAt = new Date(Date.now() + pastureSpawnIntervalMs(plot.level));

  await prisma.pasturePlot.update({
    where: { id: plotId },
    data: { displayBull: displayBull as unknown as import('@prisma/client').Prisma.InputJsonValue, nextSpawnAt },
  });

  const pastures = await listPastures();
  broadcast('pastures_updated', pastures);
  const bulls = await refreshPlayerBulls(plot.ownerId);
  if (bulls) broadcast('player_bulls_updated', { id: plot.ownerId, bulls });
  broadcast('pasture_spawned', {
    plotId,
    ownerId: plot.ownerId,
    bull: displayBull,
    trait: rolled.trait,
  });
}

export function startPastureSpawner() {
  setInterval(async () => {
    try {
      const now = new Date();
      const due = await prisma.pasturePlot.findMany({
        where: {
          ownerId: { not: null },
          OR: [{ nextSpawnAt: null }, { nextSpawnAt: { lte: now } }],
        },
      });
      for (const plot of due) {
        await spawnOnPlot(plot.id);
      }
    } catch (err) {
      console.error('Pasture spawner error', err);
    }
  }, 5_000);
}
