import {
  MAX_FOLLOWING_BULLS,
  maxFollowingForLevel,
  PASTURE_PLOTS,
  bullSlots,
  denCapacity,
  isNearPasturePlot,
} from '@bullrun/shared';
import { prisma } from '../db.js';
import { getMeResponse } from './player.js';
import { requireNearDen, requireNearInteractable } from './proximity.js';
import { broadcastPlayerBulls } from '../socket/index.js';

function broadcastBulls(userId: string) {
  return broadcastPlayerBulls(userId);
}

async function getFollowingIds(userId: string): Promise<number[]> {
  const p = await prisma.playerProfile.findUnique({ where: { userId } });
  return p?.followingBullIds ?? [];
}

async function setFollowingIds(userId: string, ids: number[]) {
  await prisma.playerProfile.update({ where: { userId }, data: { followingBullIds: ids } });
}

async function countStableBulls(userId: string): Promise<number> {
  return prisma.bull.count({ where: { ownerId: userId, location: 'stable' } });
}

async function countDenBulls(plotId: number): Promise<number> {
  return prisma.bull.count({ where: { location: 'den', denPlotId: plotId } });
}

export async function deleteBull(userId: string, bullId: number) {
  const bull = await prisma.bull.findFirst({ where: { id: bullId, ownerId: userId } });
  if (!bull) throw new Error('Bull not found');

  const loc = bull.location || 'stable';
  if (loc === 'following') throw new Error('Deposit bull first');
  const wasInDen = loc === 'den';
  if (loc === 'den') {
    if (bull.denPlotId == null) throw new Error('Invalid den');
    await requireNearDen(userId, bull.denPlotId);
  } else {
    await requireNearInteractable(userId, 'stable');
  }

  const inRace = await prisma.raceEntry.findFirst({
    where: { bullId, race: { status: { in: ['scheduled', 'running'] } } },
  });
  if (inRace) throw new Error('Bull is in a race');

  const following = await getFollowingIds(userId);
  if (following.includes(bullId)) {
    await setFollowingIds(userId, following.filter((id) => id !== bullId));
  }

  await prisma.$transaction([
    prisma.item.updateMany({ where: { equippedTo: bullId }, data: { equippedTo: null } }),
    prisma.bull.delete({ where: { id: bullId } }),
  ]);

  await broadcastBulls(userId);
  if (wasInDen) {
    const { emitPasturesUpdated } = await import('./pasture.js');
    await emitPasturesUpdated();
  }
  return getMeResponse(userId);
}

export async function takeBullFollow(userId: string, bullId: number) {
  const bull = await prisma.bull.findFirst({ where: { id: bullId, ownerId: userId } });
  if (!bull) throw new Error('Bull not found');

  const loc = bull.location || 'stable';
  if (loc === 'following') throw new Error('Already following');

  const following = await getFollowingIds(userId);
  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  const cap = Math.min(MAX_FOLLOWING_BULLS, maxFollowingForLevel(profile?.level ?? 1));
  if (following.length >= cap) {
    const next = cap === 1 ? 'Reach level 10 for a second' : cap === 2 ? 'Reach level 25 for a third' : 'No more';
    throw new Error(`Max ${cap} bull${cap > 1 ? 's' : ''} can follow you — ${next.toLowerCase()} slot`);
  }

  if (loc === 'stable') {
    await requireNearInteractable(userId, 'stable');
  } else if (loc === 'den') {
    if (bull.denPlotId == null) throw new Error('Invalid den');
    await requireNearDen(userId, bull.denPlotId);
  } else {
    throw new Error('Bull not available');
  }

  const wasInDen = loc === 'den';

  await prisma.$transaction([
    prisma.bull.update({ where: { id: bullId }, data: { location: 'following', denPlotId: null } }),
    prisma.playerProfile.update({
      where: { userId },
      data: { followingBullIds: [...following, bullId] },
    }),
  ]);

  await broadcastBulls(userId);
  if (wasInDen) {
    const { emitPasturesUpdated } = await import('./pasture.js');
    await emitPasturesUpdated();
  }
  return getMeResponse(userId);
}

export async function depositBullStable(userId: string, bullId: number) {
  const bull = await prisma.bull.findFirst({ where: { id: bullId, ownerId: userId } });
  if (!bull) throw new Error('Bull not found');
  if (bull.location !== 'following') throw new Error('Bull is not following you');

  const inRace = await prisma.raceEntry.findFirst({
    where: { bullId, race: { status: { in: ['scheduled', 'running'] } } },
  });
  if (inRace) throw new Error('Bull is signed up for a race');

  await requireNearInteractable(userId, 'stable');

  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');

  const stableCount = await countStableBulls(userId);
  const slots = bullSlots(profile.stableLevel);
  if (stableCount >= slots) throw new Error('Stable is full');

  const following = (await getFollowingIds(userId)).filter((id) => id !== bullId);
  await prisma.$transaction([
    prisma.bull.update({ where: { id: bullId }, data: { location: 'stable', denPlotId: null } }),
    prisma.playerProfile.update({ where: { userId }, data: { followingBullIds: following } }),
  ]);

  await broadcastBulls(userId);
  return getMeResponse(userId);
}

export async function depositBullDen(userId: string, bullId: number, plotId: number) {
  const plot = await prisma.pasturePlot.findUnique({ where: { id: plotId } });
  if (!plot?.ownerId || plot.ownerId !== userId) throw new Error('Not your den');

  const def = PASTURE_PLOTS.find((p) => p.id === plotId);
  if (!def) throw new Error('Plot not found');

  await requireNearDen(userId, plotId);

  const bull = await prisma.bull.findFirst({ where: { id: bullId, ownerId: userId } });
  if (!bull) throw new Error('Bull not found');

  const loc = bull.location || 'stable';
  if (loc !== 'following' && loc !== 'stable') throw new Error('Bull must be following or in stable');

  const inRace = await prisma.raceEntry.findFirst({
    where: { bullId, race: { status: { in: ['scheduled', 'running'] } } },
  });
  if (inRace) throw new Error('Bull is signed up for a race');

  const denCount = await countDenBulls(plotId);
  const cap = denCapacity(plot.level);
  if (denCount >= cap) throw new Error(`Den full (${cap} max)`);

  const following =
    loc === 'following'
      ? (await getFollowingIds(userId)).filter((id) => id !== bullId)
      : await getFollowingIds(userId);

  if (loc === 'stable') {
    await requireNearDen(userId, plotId);
  }

  await prisma.$transaction([
    prisma.bull.update({ where: { id: bullId }, data: { location: 'den', denPlotId: plotId } }),
    prisma.playerProfile.update({ where: { userId }, data: { followingBullIds: following } }),
  ]);

  const { emitPasturesUpdated } = await import('./pasture.js');
  const pastures = await emitPasturesUpdated();
  await broadcastBulls(userId);
  return { me: await getMeResponse(userId), pastures };
}
