import {
  buildWorld,
  makeShopBulls,
  nodeId,
  type Bull,
  type GameItem,
  type MeResponse,
  type Materials,
  type UserProfile,
} from '@bullrun/shared';
import type { Bull as PrismaBull, RaceEntry, MarketListing } from '@prisma/client';
import { prisma } from '../db.js';

const STARTER_BULL = {
  name: 'Tank',
  level: 1,
  xp: 0,
  speed: 7,
  stamina: 6,
  accel: 6,
  temper: 4,
  energy: 100,
  coat: '#33261d',
};

export async function initWorldNodes() {
  const world = buildWorld();
  const existing = await prisma.worldNode.count();
  if (existing > 0) return;

  await prisma.worldNode.createMany({
    data: world.nodes.map((n) => ({
      id: nodeId(n.x, n.y, n.mat),
      type: n.t,
      mat: n.mat,
      x: n.x,
      y: n.y,
    })),
  });
}

export async function createStarterUser(userId: string) {
  const profile = await prisma.playerProfile.create({
    data: {
      userId,
      gold: 500,
      hay: 6,
      ore: 20,
      wood: 4,
    },
  });
  await prisma.bull.create({
    data: { ownerId: userId, ...STARTER_BULL },
  });
  return profile;
}

function mapBull(b: {
  id: number;
  name: string;
  level: number;
  xp: number;
  speed: number;
  stamina: number;
  accel: number;
  temper: number;
  energy: number;
  coat: string;
}): Bull {
  return {
    id: b.id,
    name: b.name,
    level: b.level,
    xp: b.xp,
    speed: b.speed,
    stamina: b.stamina,
    accel: b.accel,
    temper: b.temper,
    energy: b.energy,
    coat: b.coat,
  };
}

function mapItem(it: {
  id: number;
  slot: string;
  rarity: string;
  rarityColor: string;
  name: string;
  color: string;
  bonusStat: string | null;
  bonusAmt: number | null;
  equippedTo: number | null;
}): GameItem {
  return {
    id: it.id,
    slot: it.slot as GameItem['slot'],
    rarity: it.rarity as GameItem['rarity'],
    rarityColor: it.rarityColor,
    name: it.name,
    color: it.color,
    bonus: it.bonusStat && it.bonusAmt != null
      ? { stat: it.bonusStat as 'speed' | 'stamina' | 'accel', amt: it.bonusAmt }
      : null,
    equippedTo: it.equippedTo,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, bulls: true, items: true },
  });
  if (!user?.profile) return null;

  const p = user.profile;
  const breeding =
    p.breedingAId && p.breedingBId && p.breedingDone
      ? {
          a: mapBull(user.bulls.find((b: PrismaBull) => b.id === p.breedingAId)!),
          b: mapBull(user.bulls.find((b: PrismaBull) => b.id === p.breedingBId)!),
          done: p.breedingDone.getTime(),
        }
      : null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    gold: p.gold,
    mats: { hay: p.hay, ore: p.ore, wood: p.wood },
    stable: { level: p.stableLevel, wood: p.stableWood },
    helpSeen: p.helpSeen,
    position: { x: p.posX, y: p.posY },
    bulls: user.bulls.map(mapBull),
    items: user.items.map(mapItem),
    entered: [],
    bet: null,
    betAmount: p.betAmount,
    breeding,
    breedSel: p.breedSel,
    forgeOre: p.forgeOre,
    listPrice: { hay: p.listHay, ore: p.listOre, wood: p.listWood },
  };
}

export async function getMeResponse(userId: string): Promise<MeResponse | null> {
  const profile = await getUserProfile(userId);
  if (!profile) return null;

  const currentRace = await prisma.race.findFirst({
    where: { status: { in: ['scheduled', 'running'] } },
    orderBy: { startAt: 'asc' },
    include: { entries: true, bets: { where: { userId } } },
  });

  const listings = await prisma.marketListing.findMany({
    where: { status: 'open' },
    include: { seller: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const myEntries = currentRace?.entries.filter((e: RaceEntry) => e.userId === userId).map((e: RaceEntry) => e.bullId).filter(Boolean) as number[] ?? [];
  const myBet = currentRace?.bets[0];

  return {
    ...profile,
    entered: myEntries,
    bet: myBet
      ? { bullId: myBet.targetBullId, name: myBet.targetName, amount: myBet.amount, odds: myBet.odds }
      : null,
    race: currentRace
      ? {
          id: currentRace.id,
          status: currentRace.status,
          startAt: currentRace.startAt.toISOString(),
          field: currentRace.field as unknown as import('@bullrun/shared').NpcBull[],
          entered: currentRace.entries.filter((e: RaceEntry) => !e.isNpc).map((e: RaceEntry) => String(e.bullId)),
        }
      : null,
    marketListings: listings.map((l: MarketListing & { seller: { displayName: string } }) => ({
      id: l.id,
      sellerId: l.sellerId,
      sellerName: l.seller.displayName,
      type: l.type as 'material' | 'item' | 'bull',
      mat: (l.mat ?? undefined) as 'hay' | 'ore' | 'wood' | undefined,
      qty: l.qty ?? undefined,
      item: l.itemData as unknown as GameItem | undefined,
      bull: l.bullData as unknown as Partial<Bull> | undefined,
      price: l.price,
      status: l.status as 'open' | 'sold',
      soldAt: l.soldAt?.getTime(),
    })),
    shopBulls: makeShopBulls(),
  };
}

export async function updatePosition(userId: string, x: number, y: number) {
  await prisma.playerProfile.update({
    where: { userId },
    data: { posX: x, posY: y },
  });
}
