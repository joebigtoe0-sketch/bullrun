import type { Server as SocketServer } from 'socket.io';
import {
  PASTURE_PLOTS,
  PASTURE_WOOD_UPGRADE_COST,
  PASTURE_WOOD_PER_LEVEL,
  MAX_DENS_PER_PLAYER,
  pastureUpgradeGoldCost,
  denCapacity,
  pastureSpawnIntervalMs,
  pastureWoodToNextLevel,
  rollPastureBull,
  type PasturePlotState,
} from '@bullrun/shared';
import { prisma } from '../db.js';
import { getMeResponse } from './player.js';
import { broadcastPlayerBulls } from '../socket/index.js';

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

/** Rebuild pasture state and push to all connected clients. */
export async function emitPasturesUpdated(): Promise<PasturePlotState[]> {
  const pastures = await listPastures();
  broadcast('pastures_updated', pastures);
  return pastures;
}

async function denCountForPlot(plotId: number): Promise<number> {
  return prisma.bull.count({ where: { location: 'den', denPlotId: plotId } });
}

function mapBull(b: {
  id: number;
  name: string;
  coat: string;
  trait: string;
  rarity: string;
  level: number;
  speed: number;
  stamina: number;
  accel: number;
}): import('@bullrun/shared').PastureDisplayBull {
  return {
    id: b.id,
    name: b.name,
    coat: b.coat,
    trait: b.trait as import('@bullrun/shared').BullTrait,
    rarity: b.rarity as import('@bullrun/shared').BullRarity,
    level: b.level,
    speed: b.speed,
    stamina: b.stamina,
    accel: b.accel,
  };
}

function mapPlot(
  row: {
    id: number;
    ownerId: string | null;
    level: number;
    woodInvested: number;
    nextSpawnAt: Date | null;
    owner?: { displayName: string } | null;
  },
  denCount: number,
  denBulls: import('@bullrun/shared').PastureDisplayBull[],
): PasturePlotState {
  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerName: row.owner?.displayName ?? null,
    level: row.level,
    woodInvested: row.woodInvested,
    displayBull: denBulls[0] ?? null,
    denBulls,
    denCount,
    denCapacity: denCapacity(row.level),
    nextSpawnAt: row.nextSpawnAt?.getTime() ?? null,
  };
}

export async function listPastures(): Promise<PasturePlotState[]> {
  const rows = await prisma.pasturePlot.findMany({
    include: { owner: true },
    orderBy: { id: 'asc' },
  });
  const counts = await prisma.bull.groupBy({
    by: ['denPlotId'],
    where: { location: 'den', denPlotId: { not: null } },
    _count: { _all: true },
  });
  const denBullRows = await prisma.bull.findMany({
    where: { location: 'den', denPlotId: { not: null } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      coat: true,
      trait: true,
      rarity: true,
      level: true,
      speed: true,
      stamina: true,
      accel: true,
      denPlotId: true,
    },
  });
  const countMap = new Map(counts.map((c) => [c.denPlotId!, c._count._all]));
  const bullsByPlot = new Map<number, import('@bullrun/shared').PastureDisplayBull[]>();
  for (const b of denBullRows) {
    if (b.denPlotId == null) continue;
    const list = bullsByPlot.get(b.denPlotId) ?? [];
    list.push(mapBull(b));
    bullsByPlot.set(b.denPlotId, list);
  }
  return rows.map((r) => mapPlot(r, countMap.get(r.id) ?? 0, bullsByPlot.get(r.id) ?? []));
}

export async function buyPasture(userId: string, plotId: number) {
  const def = PASTURE_PLOTS.find((p) => p.id === plotId);
  if (!def) throw new Error('Plot not found');

  const plot = await prisma.pasturePlot.findUnique({ where: { id: plotId } });
  if (!plot) throw new Error('Plot not found');
  if (plot.ownerId) throw new Error('Plot already owned');

  const owned = await prisma.pasturePlot.count({ where: { ownerId: userId } });
  if (owned >= MAX_DENS_PER_PLAYER) throw new Error('You can only own one den');

  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');
  if (profile.gold < def.price) throw new Error(`Need ${def.price}g`);
  if (profile.wood < 5) throw new Error('Need 5 wood to establish a den');

  const nextSpawnAt = new Date(Date.now() + pastureSpawnIntervalMs(1));

  await prisma.$transaction([
    prisma.playerProfile.update({
      where: { userId },
      data: { gold: profile.gold - def.price, wood: profile.wood - 5 },
    }),
    prisma.pasturePlot.update({
      where: { id: plotId },
      data: { ownerId: userId, level: 1, woodInvested: 0, nextSpawnAt },
    }),
  ]);

  const pastures = await emitPasturesUpdated();
  return { me: await getMeResponse(userId), pastures };
}

export async function upgradePasture(userId: string, plotId: number) {
  const plot = await prisma.pasturePlot.findUnique({ where: { id: plotId } });
  if (!plot) throw new Error('Plot not found');
  if (plot.ownerId !== userId) throw new Error('Not your plot');

  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');
  const goldCost = pastureUpgradeGoldCost(plot.level);
  if (profile.gold < goldCost) throw new Error(`Need ${goldCost}g`);
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
      data: { wood: profile.wood - PASTURE_WOOD_UPGRADE_COST, gold: profile.gold - goldCost },
    }),
    prisma.pasturePlot.update({
      where: { id: plotId },
      data: { level, woodInvested },
    }),
  ]);

  const pastures = await emitPasturesUpdated();
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

  const denCount = await denCountForPlot(plotId);
  const cap = denCapacity(plot.level);
  const nextSpawnAt = new Date(Date.now() + pastureSpawnIntervalMs(plot.level));

  if (denCount >= cap) {
    await prisma.pasturePlot.update({ where: { id: plotId }, data: { nextSpawnAt } });
    return;
  }

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
      rarity: rolled.rarity,
      location: 'den',
      denPlotId: plotId,
    },
  });

  await prisma.pasturePlot.update({
    where: { id: plotId },
    data: { nextSpawnAt },
  });

  await emitPasturesUpdated();
  await broadcastPlayerBulls(plot.ownerId);
  broadcast('pasture_spawned', {
    plotId,
    ownerId: plot.ownerId,
    bull: { id: bull.id, name: bull.name, coat: bull.coat, trait: rolled.trait },
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
