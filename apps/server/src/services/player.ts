import {
  buildWorld,
  makeShopBulls,
  nodeId,
  normalizeStat,
  pickStarterBullName,
  inferBullRarity,
  COAT_COLORS,
  type Bull,
  type GameItem,
  type MeResponse,
  type Materials,
  type UserProfile,
} from '@bullrace/shared';
import type { Bull as PrismaBull, RaceEntry, MarketListing } from '@prisma/client';
import { prisma } from '../db.js';

const STARTER_BULL_STATS = {
  level: 1,
  xp: 0,
  speed: 72,
  stamina: 65,
  accel: 65,
  temper: 4,
  energy: 100,
};

export async function syncWorldNodes() {
  const world = buildWorld();
  const nodes = world.nodes.map((n) => ({
    id: nodeId(n.x, n.y, n.mat),
    type: n.t,
    mat: n.mat,
    x: n.x,
    y: n.y,
  }));

  for (const n of nodes) {
    await prisma.worldNode.upsert({
      where: { id: n.id },
      create: n,
      update: { x: n.x, y: n.y, type: n.type, mat: n.mat },
    });
  }

  const validIds = new Set(nodes.map((n) => n.id));
  const existing = await prisma.worldNode.findMany({ select: { id: true } });
  for (const e of existing) {
    if (!validIds.has(e.id)) {
      await prisma.worldNode.delete({ where: { id: e.id } });
    }
  }
}

export async function initWorldNodes() {
  await syncWorldNodes();
}

export async function createStarterUser(userId: string) {
  const profile = await prisma.playerProfile.create({
    data: {
      userId,
      gold: 0,
      hay: 0,
      ore: 0,
      wood: 0,
    },
  });
  const bull = await prisma.bull.create({
    data: {
      ownerId: userId,
      name: pickStarterBullName(Date.now()),
      coat: COAT_COLORS[Math.floor(Math.random() * COAT_COLORS.length)],
      trait: 'normal',
      rarity: 'common',
      location: 'following',
      ...STARTER_BULL_STATS,
    },
  });
  await prisma.playerProfile.update({
    where: { userId },
    data: { followingBullIds: [bull.id] },
  });
  return profile;
}

export function mapBull(b: {
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
  trait: string;
  rarity?: string;
  location?: string;
  denPlotId?: number | null;
}): Bull {
  return {
    id: b.id,
    name: b.name,
    level: b.level,
    xp: b.xp,
    speed: normalizeStat(b.speed),
    stamina: normalizeStat(b.stamina),
    accel: normalizeStat(b.accel),
    temper: b.temper,
    energy: b.energy,
    coat: b.coat,
    trait: (b.trait as Bull['trait']) || 'normal',
    rarity: inferBullRarity(b.trait as Bull['trait'], b.rarity as Bull['rarity']),
    location: (b.location as Bull['location']) || 'stable',
    denPlotId: b.denPlotId ?? null,
  };
}

function mapItem(it: {
  id: number;
  kind?: string;
  equippedChar?: boolean;
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
      ? { stat: it.bonusStat as NonNullable<GameItem['bonus']>['stat'], amt: it.bonusAmt }
      : null,
    equippedTo: it.equippedTo,
    kind: (it.kind ?? 'bull') as GameItem['kind'],
    equipped: it.equippedChar ?? false,
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
    walletAddress: user.walletAddress,
    hasDisplayName: user.hasDisplayName,
    gold: p.gold,
    mats: { hay: p.hay, ore: p.ore, wood: p.wood },
    stable: { level: p.stableLevel, wood: p.stableWood },
    level: p.level ?? 1,
    xp: p.xp ?? 0,
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
    followingBullIds: p.followingBullIds ?? [],
  };
}

export async function getMeResponse(userId: string): Promise<MeResponse | null> {
  const profile = await getUserProfile(userId);
  if (!profile) return null;

  const rawProfile = await prisma.playerProfile.findUnique({
    where: { userId },
    select: { lastWheelSpinAt: true },
  });
  const { nextWheelSpinAt, todaysJackpot } = await import('./charShop.js');
  const { isAdminUser } = await import('./ansem.js');

  const currentRace = await prisma.race.findFirst({
    where: { status: { in: ['scheduled', 'running'] } },
    orderBy: { startAt: 'asc' },
    include: { entries: true, bets: { where: { userId } } },
  });

  const listings = await prisma.marketListing.findMany({
    where: {
      OR: [
        { status: 'open' },
        { sellerId: userId, type: 'gold', status: { in: ['reserved', 'cancelling'] } },
      ],
    },
    include: { seller: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const myEntries = currentRace?.entries.filter((e: RaceEntry) => e.userId === userId).map((e: RaceEntry) => e.bullId).filter(Boolean) as number[] ?? [];
  const myBet = currentRace?.bets[0];

  return {
    ...profile,
    isAdmin: isAdminUser({ username: profile.username, displayName: profile.displayName }),
    wheelAvailableAt: nextWheelSpinAt(rawProfile?.lastWheelSpinAt ?? null),
    wheelJackpot: todaysJackpot(),
    entered: myEntries,
    bet: myBet
      ? { bullId: myBet.targetBullId, name: myBet.targetName, amount: myBet.amount, odds: myBet.odds }
      : null,
    race: currentRace
      ? {
          id: currentRace.id,
          status: currentRace.status,
          startAt: currentRace.startAt.toISOString(),
          field: [],
          entered: currentRace.entries.filter((e: RaceEntry) => !e.isNpc).map((e: RaceEntry) => String(e.bullId)),
        }
      : null,
    marketListings: listings.map((l: MarketListing & { seller: { displayName: string } }) => ({
      id: l.id,
      sellerId: l.sellerId,
      sellerName: l.seller.displayName,
      type: l.type as 'material' | 'item' | 'bull' | 'gold',
      mat: (l.mat ?? undefined) as 'hay' | 'ore' | 'wood' | undefined,
      qty: l.qty ?? undefined,
      item: l.itemData as unknown as GameItem | undefined,
      bull: l.bullData as unknown as Partial<Bull> | undefined,
      price: l.price,
      tokenPrice: l.tokenPrice ? Number(l.tokenPrice.toString()) : undefined,
      status: l.status as import('@bullrace/shared').MarketListing['status'],
      soldAt: l.soldAt?.getTime(),
      cooldownUntil: l.cooldownUntil?.getTime(),
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
