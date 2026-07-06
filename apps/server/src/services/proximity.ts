import { buildWorld, isNearInteractable } from '@bullrun/shared';
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
