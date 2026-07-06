import { odds, type GameItem, type NpcBull, type RaceBull } from '@bullrun/shared';
import type { Item as PrismaItem } from '@prisma/client';
import { prisma } from '../db.js';

function mapItem(it: PrismaItem): GameItem {
  return {
    id: it.id,
    slot: it.slot as GameItem['slot'],
    rarity: it.rarity as GameItem['rarity'],
    rarityColor: it.rarityColor,
    name: it.name,
    color: it.color,
    bonus: it.bonusStat ? { stat: it.bonusStat as 'speed', amt: it.bonusAmt ?? 0 } : null,
    equippedTo: it.equippedTo,
  };
}

export async function buildBettingField(raceId: string): Promise<{
  field: RaceBull[];
  items: GameItem[];
}> {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: { entries: { include: { user: { include: { items: true } } } } },
  });
  if (!race) return { field: [], items: [] };

  const playerBulls: RaceBull[] = [];
  for (const e of race.entries) {
    if (e.isNpc || !e.bullId) continue;
    const bull = await prisma.bull.findUnique({ where: { id: e.bullId } });
    if (!bull) continue;
    playerBulls.push({
      ...bull,
      owner: e.user?.displayName || 'Player',
      isMine: false,
    } as RaceBull);
  }

  const npcs = (race.field as unknown as NpcBull[]).map((n, i) => ({
    ...n,
    id: `npc${i}`,
    isNpc: true as const,
  }));

  const items = race.entries.flatMap((e) => e.user?.items ?? []).map(mapItem);
  const field = [...playerBulls, ...npcs].slice(0, 6) as RaceBull[];

  return { field, items };
}

export async function computeRaceOdds(raceId: string) {
  const { field, items } = await buildBettingField(raceId);
  return { field, odds: odds(field, items) };
}
