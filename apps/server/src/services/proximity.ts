import { buildWorld, isNearInteractable, isNearPasturePlot } from '@bullrun/shared';
import { prisma } from '../db.js';

const { interactables } = buildWorld(0);

async function resolvePosition(
  userId: string,
  type: 'stable' | 'bet' | 'market' | 'forge' | 'race' | 'shop' | 'wheel',
  clientX?: number,
  clientY?: number,
): Promise<{ x: number; y: number } | null> {
  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  if (
    clientX != null &&
    clientY != null &&
    Number.isFinite(clientX) &&
    Number.isFinite(clientY) &&
    isNearInteractable(clientX, clientY, type, interactables)
  ) {
    if (Math.hypot(clientX - profile.posX, clientY - profile.posY) > 0.05) {
      await prisma.playerProfile.update({
        where: { userId },
        data: { posX: clientX, posY: clientY },
      });
    }
    return { x: clientX, y: clientY };
  }

  return { x: profile.posX, y: profile.posY };
}

export async function requireNearInteractable(
  userId: string,
  type: 'stable' | 'bet' | 'market' | 'forge' | 'race' | 'shop' | 'wheel',
  clientX?: number,
  clientY?: number,
) {
  const pos = await resolvePosition(userId, type, clientX, clientY);
  if (!pos || !isNearInteractable(pos.x, pos.y, type, interactables)) {
    throw new Error('Too far away');
  }
}

export async function requireNearDen(userId: string, plotId: number) {
  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile || !isNearPasturePlot(profile.posX, profile.posY, plotId)) {
    throw new Error('Too far from den');
  }
}
