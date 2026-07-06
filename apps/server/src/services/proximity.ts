import { buildWorld, isNearInteractable, isNearPasturePlot } from '@bullrun/shared';
import { prisma } from '../db.js';

const { interactables } = buildWorld(0);

export async function requireNearInteractable(
  userId: string,
  type: 'stable' | 'bet' | 'market' | 'forge' | 'race',
) {
  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile || !isNearInteractable(profile.posX, profile.posY, type, interactables)) {
    throw new Error('Too far away');
  }
}

export async function requireNearDen(userId: string, plotId: number) {
  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile || !isNearPasturePlot(profile.posX, profile.posY, plotId)) {
    throw new Error('Too far from den');
  }
}
