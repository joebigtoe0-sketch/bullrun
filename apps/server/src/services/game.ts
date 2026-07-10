import type { Server as SocketServer } from 'socket.io';
import {
  BREED_COST,
  BREED_DURATION_MS,
  BULL_MAX_ENERGY,
  GATHER_DURATION_MS,
  MARKET_FEE,
  NODE_RESPAWN_MS,
  RACE_ENTRY_ENERGY,
  REST_COST,
  REST_ENERGY,
  buildWorld,
  bullSlots,
  clampForgeOre,
  energyPerTick,
  inferBullRarity,
  makeItem,
  nodeId,
  normalizeStat,
  traitForRarity,
  statRangeForRarity,
  rollRarityIndex,
  pickRandomBullName,
  statCap,
  TRAIN_STAT_GAIN,
  trainHayCost,
  stableGoldNeed,
  stableWoodNeed,
  type MatType,
  type StatType,
  gatherBonusQty,
  applyXpGain,
  rollBreedRarity,
  type BullTrait,
  type BullRarity,
} from '@bullrun/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { getMeResponse, mapBull } from './player.js';
import { requireNearInteractable } from './proximity.js';
import { computeRaceOdds } from './raceOdds.js';

type Io = SocketServer | null;
let io: Io = null;

export function setIo(server: SocketServer) {
  io = server;
}

export function broadcast(event: string, data: unknown) {
  io?.emit(event, data);
}

async function getProfile(userId: string) {
  const p = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!p) throw new Error('Profile not found');
  return p;
}

export async function trainBull(userId: string, bullId: number, stat: StatType) {
  await requireNearInteractable(userId, 'stable');
  const [bull, profile] = await Promise.all([
    prisma.bull.findFirst({ where: { id: bullId, ownerId: userId } }),
    getProfile(userId),
  ]);
  if (!bull) throw new Error('Bull not found');
  const cap = statCap(mapBull(bull));
  const cur = normalizeStat(bull[stat]);
  const cost = trainHayCost(bull.level);
  if (cur >= cap) throw new Error(`${stat} capped at ${cap}`);
  if (profile.hay < cost) throw new Error(`Need ${cost} hay`);

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { hay: profile.hay - cost } }),
    prisma.bull.update({ where: { id: bullId }, data: { [stat]: cur + TRAIN_STAT_GAIN } }),
  ]);
  return getMeResponse(userId);
}

export async function restBull(userId: string, bullId: number) {
  await requireNearInteractable(userId, 'stable');
  const [bull, profile] = await Promise.all([
    prisma.bull.findFirst({ where: { id: bullId, ownerId: userId } }),
    getProfile(userId),
  ]);
  if (!bull) throw new Error('Bull not found');
  if (profile.gold < REST_COST) throw new Error('Need 40g');
  if (bull.energy >= BULL_MAX_ENERGY) throw new Error('Already rested');

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { gold: profile.gold - REST_COST } }),
    prisma.bull.update({ where: { id: bullId }, data: { energy: Math.min(BULL_MAX_ENERGY, bull.energy + REST_ENERGY) } }),
  ]);
  return getMeResponse(userId);
}

export async function upgradeStable(userId: string) {
  await requireNearInteractable(userId, 'stable');
  const p = await getProfile(userId);
  const need = stableWoodNeed(p.stableLevel);
  const goldNeed = stableGoldNeed(p.stableLevel);

  if (p.stableWood >= need) {
    if (p.gold < goldNeed) throw new Error(`Need ${goldNeed}g to reach stable level ${p.stableLevel + 1}`);
    await prisma.playerProfile.update({
      where: { userId },
      data: {
        gold: p.gold - goldNeed,
        stableWood: 0,
        stableLevel: p.stableLevel + 1,
      },
    });
    return getMeResponse(userId);
  }

  if (p.wood < 10) throw new Error('Need 10 wood');
  let wood = p.stableWood + 10;
  const matsWood = p.wood - 10;
  let level = p.stableLevel;
  let gold = p.gold;

  if (wood >= need) {
    if (gold < goldNeed) {
      wood = need;
    } else {
      level += 1;
      wood = 0;
      gold -= goldNeed;
    }
  }

  await prisma.playerProfile.update({
    where: { userId },
    data: { wood: matsWood, gold, stableWood: wood, stableLevel: level },
  });
  return getMeResponse(userId);
}

export async function renameBull(userId: string, bullId: number, name: string) {
  await requireNearInteractable(userId, 'stable');
  await prisma.bull.updateMany({
    where: { id: bullId, ownerId: userId },
    data: { name: name.trim().slice(0, 14) },
  });
  return getMeResponse(userId);
}

export async function breedBulls(userId: string, bullAId: number, bullBId: number) {
  await requireNearInteractable(userId, 'stable');
  const p = await getProfile(userId);
  const bulls = await prisma.bull.findMany({ where: { ownerId: userId } });
  if (bulls.length >= bullSlots(p.stableLevel)) throw new Error('No free bull slots');
  const bullA = bulls.find((b) => b.id === bullAId);
  const bullB = bulls.find((b) => b.id === bullBId);
  if (!bullA || !bullB) throw new Error('Bulls not found');
  if ((bullA.location ?? 'stable') !== 'stable' || (bullB.location ?? 'stable') !== 'stable') {
    throw new Error('Both bulls must be in your stable');
  }
  if (p.gold < BREED_COST) throw new Error(`Need ${BREED_COST}g`);

  await prisma.playerProfile.update({
    where: { userId },
    data: {
      gold: p.gold - BREED_COST,
      breedingAId: bullAId,
      breedingBId: bullBId,
      breedingDone: new Date(Date.now() + BREED_DURATION_MS),
      breedSel: [],
    },
  });
  return getMeResponse(userId);
}

export async function completeBreed(userId: string) {
  const p = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!p?.breedingAId || !p.breedingBId || !p.breedingDone) return null;
  if (p.breedingDone.getTime() > Date.now()) return null;

  const bulls = await prisma.bull.findMany({ where: { ownerId: userId } });
  if (bulls.length >= bullSlots(p.stableLevel)) return null;

  const [a, b] = await Promise.all([
    prisma.bull.findUnique({ where: { id: p.breedingAId } }),
    prisma.bull.findUnique({ where: { id: p.breedingBId } }),
  ]);
  if (!a || !b) return null;

  const rarityA = inferBullRarity(a.trait as BullTrait, a.rarity as BullRarity);
  const rarityB = inferBullRarity(b.trait as BullTrait, b.rarity as BullRarity);
  const rarity = rollBreedRarity(rarityA, rarityB, Math.random());
  const trait = traitForRarity(rarity, Math.random());
  const range = statRangeForRarity(rarity);
  const mix = (k: 'speed' | 'stamina' | 'accel' | 'temper') =>
    Math.max(range.min, Math.min(range.max, Math.round((a[k] + b[k]) / 2 + (Math.random() * 6 - 3))));

  await prisma.$transaction([
    prisma.bull.create({
      data: {
        ownerId: userId,
        name: pickRandomBullName(),
        speed: mix('speed'),
        stamina: mix('stamina'),
        accel: mix('accel'),
        temper: mix('temper'),
        energy: BULL_MAX_ENERGY,
        coat: Math.random() < 0.5 ? a.coat : b.coat,
        trait,
        rarity,
        location: 'stable',
      },
    }),
    prisma.playerProfile.update({
      where: { userId },
      data: { breedingAId: null, breedingBId: null, breedingDone: null },
    }),
  ]);
  return getMeResponse(userId);
}

export async function forgeItem(userId: string, oreAmount: number) {
  await requireNearInteractable(userId, 'forge');
  const p = await getProfile(userId);
  const ore = clampForgeOre(oreAmount);
  if (p.ore < ore) throw new Error(`Need at least ${ore} ore`);

  const rarIdx = rollRarityIndex(ore);
  const item = makeItem(rarIdx, p.nextItemId);

  await prisma.$transaction([
    prisma.playerProfile.update({
      where: { userId },
      data: { ore: p.ore - ore, nextItemId: p.nextItemId + 1 },
    }),
    prisma.item.create({
      data: {
        ownerId: userId,
        slot: item.slot,
        rarity: item.rarity,
        rarityColor: item.rarityColor,
        name: item.name,
        color: item.color,
        bonusStat: item.bonus?.stat ?? null,
        bonusAmt: item.bonus?.amt ?? null,
      },
    }),
  ]);
  const me = await getMeResponse(userId);
  return { me, item };
}

export async function equipItem(userId: string, itemId: number, bullId: number) {
  const [item, bull] = await Promise.all([
    prisma.item.findFirst({ where: { id: itemId, ownerId: userId } }),
    prisma.bull.findFirst({ where: { id: bullId, ownerId: userId } }),
  ]);
  if (!item || !bull) throw new Error('Not found');

  await prisma.$transaction([
    prisma.item.updateMany({ where: { ownerId: userId, equippedTo: bullId, slot: item.slot }, data: { equippedTo: null } }),
    prisma.item.update({ where: { id: itemId }, data: { equippedTo: bullId } }),
  ]);
  return getMeResponse(userId);
}

export async function unequipItem(userId: string, itemId: number) {
  await prisma.item.updateMany({ where: { id: itemId, ownerId: userId }, data: { equippedTo: null } });
  return getMeResponse(userId);
}

export async function startGather(userId: string, nodeIdStr: string) {
  const node = await prisma.worldNode.findUnique({ where: { id: nodeIdStr } });
  if (!node) throw new Error('Node not found');
  if (node.deadUntil && node.deadUntil.getTime() > Date.now()) throw new Error('Node depleted');
  return { nodeId: node.id, dur: GATHER_DURATION_MS };
}

export async function completeGather(userId: string, nodeIdStr: string, nearX?: number, nearY?: number) {
  let node = await prisma.worldNode.findUnique({ where: { id: nodeIdStr } });

  if (!node && nearX != null && nearY != null) {
    const profile = await prisma.playerProfile.findUnique({ where: { userId } });
    const px = profile?.posX ?? nearX;
    const py = profile?.posY ?? nearY;
    const live = await prisma.worldNode.findMany({
      where: {
        OR: [{ deadUntil: null }, { deadUntil: { lte: new Date() } }],
      },
    });
    let best: (typeof live)[0] | null = null;
    let bestD = 2.5;
    for (const n of live) {
      const d = Math.hypot(n.x - px, n.y - py);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    if (!best) {
      const world = buildWorld();
      for (const n of world.nodes) {
        const d = Math.hypot(n.x - px, n.y - py);
        if (d < bestD) {
          bestD = d;
          const id = nodeId(n.x, n.y, n.mat);
          best = { id, type: n.t, mat: n.mat, x: n.x, y: n.y, deadUntil: null };
        }
      }
      if (best && !(await prisma.worldNode.findUnique({ where: { id: best.id } }))) {
        await prisma.worldNode.create({
          data: { id: best.id, type: best.type, mat: best.mat, x: best.x, y: best.y },
        });
      }
    }
    node = best;
  }

  if (!node) throw new Error('Node not found');
  if (node.deadUntil && node.deadUntil.getTime() > Date.now()) throw new Error('Node depleted');

  const resolvedId = node.id;

  const p = await getProfile(userId);
  const qty = 2 + Math.floor(Math.random() * 3) + gatherBonusQty(p.level ?? 1);
  const mat = node.mat as MatType;
  const deadUntil = new Date(Date.now() + NODE_RESPAWN_MS);

  const matField = mat === 'hay' ? 'hay' : mat === 'ore' ? 'ore' : 'wood';

  // 1 XP per resource gathered
  const gained = applyXpGain(p.level ?? 1, p.xp ?? 0, qty);

  await prisma.$transaction([
    prisma.worldNode.update({ where: { id: resolvedId }, data: { deadUntil } }),
    prisma.playerProfile.update({
      where: { userId },
      data: {
        [matField]: (p[matField as 'hay'] as number) + qty,
        level: gained.level,
        xp: gained.xp,
      },
    }),
  ]);

  broadcast('node_depleted', { id: resolvedId, deadUntil: deadUntil.getTime() });
  return { qty, mat, xp: qty, leveledUp: gained.leveledUp, me: await getMeResponse(userId) };
}

export async function enterRace(userId: string, bullId: number, clientX?: number, clientY?: number) {
  await requireNearInteractable(userId, 'race', clientX, clientY);
  const race = await prisma.race.findFirst({ where: { status: 'scheduled' }, orderBy: { startAt: 'asc' } });
  if (!race) throw new Error('No scheduled race');
  if (race.startAt.getTime() <= Date.now()) throw new Error('Race locked');

  const existing = await prisma.raceEntry.findFirst({ where: { raceId: race.id, userId, bullId } });
  if (existing) throw new Error('Already entered');

  const [bull, profile, userEntries] = await Promise.all([
    prisma.bull.findFirst({ where: { id: bullId, ownerId: userId } }),
    getProfile(userId),
    prisma.raceEntry.count({ where: { raceId: race.id, userId } }),
  ]);
  if (!bull) throw new Error('Bull not found');
  const following = profile.followingBullIds ?? [];
  if (!following.includes(bullId) || bull.location !== 'following') {
    throw new Error('Only a bull following you can enter');
  }
  if (userEntries > 0) throw new Error('One bull per race');
  if (bull.energy < RACE_ENTRY_ENERGY) throw new Error(`Need ${RACE_ENTRY_ENERGY} energy`);

  await prisma.$transaction([
    prisma.bull.update({ where: { id: bullId }, data: { energy: bull.energy - RACE_ENTRY_ENERGY } }),
    prisma.raceEntry.create({
      data: { raceId: race.id, userId, bullId, isNpc: false, bullData: bull },
    }),
  ]);
  return getMeResponse(userId);
}

export async function placeBet(
  userId: string,
  targetBullId: string,
  targetName: string,
  amount: number,
  _clientOdds: number,
  clientX?: number,
  clientY?: number,
) {
  await requireNearInteractable(userId, 'bet', clientX, clientY);
  const race = await prisma.race.findFirst({ where: { status: 'scheduled' }, orderBy: { startAt: 'asc' } });
  if (!race) throw new Error('No scheduled race');

  const existing = await prisma.bet.findFirst({ where: { raceId: race.id, userId } });
  if (existing) throw new Error('One bet per race');

  const { field, odds: oddsArr } = await computeRaceOdds(race.id);
  const idx = field.findIndex((b) => String(b.id) === targetBullId);
  if (idx < 0) throw new Error('Bull not in this race');
  const serverOdds = oddsArr[idx];

  const p = await getProfile(userId);
  if (p.gold < amount) throw new Error('Not enough gold');

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { gold: p.gold - amount } }),
    prisma.bet.create({
      data: {
        raceId: race.id,
        userId,
        targetBullId,
        targetName: field[idx]?.name ?? targetName,
        amount,
        odds: serverOdds,
      },
    }),
  ]);
  return getMeResponse(userId);
}

export async function listMaterial(userId: string, mat: MatType, pricePer100: number, qty: number) {
  await requireNearInteractable(userId, 'market');
  const allowed = [100, 500, 1000];
  if (!allowed.includes(qty)) throw new Error('List 100, 500, or 1000 only');
  if (pricePer100 < 1) throw new Error('Minimum 1 gold per 100');

  const p = await getProfile(userId);
  const field = mat;
  if ((p[field] as number) < qty) throw new Error(`Need ${qty} ${mat}`);

  const price = Math.max(1, Math.round((pricePer100 * qty) / 100));

  const listing = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.playerProfile.update({
      where: { userId },
      data: { [field]: (p[field] as number) - qty },
    });
    return tx.marketListing.create({
      data: {
        sellerId: userId,
        type: 'material',
        mat,
        qty,
        price,
        status: 'open',
      },
      include: { seller: true },
    });
  });

  const payload = {
    id: listing.id,
    sellerId: listing.sellerId,
    sellerName: listing.seller.displayName,
    type: 'material' as const,
    mat,
    qty,
    price: listing.price,
    status: 'open' as const,
  };
  broadcast('listing_created', payload);
  return getMeResponse(userId);
}

async function assertCanListBull(userId: string, bullId: number) {
  const bull = await prisma.bull.findFirst({ where: { id: bullId, ownerId: userId } });
  if (!bull) throw new Error('Bull not found');
  if ((bull.location || 'stable') !== 'stable') throw new Error('Bull must be in your stable');
  if (bull.location === 'following') throw new Error('Deposit bull first');

  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');
  if (profile.followingBullIds.includes(bullId)) {
    throw new Error('Deposit bull first');
  }
  if (profile.breedingAId === bullId || profile.breedingBId === bullId) {
    throw new Error('Bull is breeding');
  }

  const inRace = await prisma.raceEntry.findFirst({
    where: { bullId, race: { status: { in: ['scheduled', 'running'] } } },
  });
  if (inRace) throw new Error('Bull is in a race');

  const existing = await prisma.marketListing.findFirst({
    where: { sellerId: userId, type: 'bull', status: 'open' },
  });
  if (existing) throw new Error('You already have a bull listed (one at a time)');

  return bull;
}

function bullListingSnapshot(bull: {
  name: string;
  level: number;
  xp: number;
  speed: number;
  stamina: number;
  accel: number;
  temper: number;
  coat: string;
  trait: string;
  rarity: string;
  energy: number;
}) {
  return {
    name: bull.name,
    level: bull.level,
    xp: bull.xp,
    speed: bull.speed,
    stamina: bull.stamina,
    accel: bull.accel,
    temper: bull.temper,
    coat: bull.coat,
    trait: bull.trait,
    rarity: bull.rarity,
    energy: bull.energy,
  };
}

export async function listBull(userId: string, bullId: number, price: number) {
  await requireNearInteractable(userId, 'market');
  const amount = Math.floor(price);
  if (amount < 1) throw new Error('Price must be at least 1g');
  if (amount > 1_000_000) throw new Error('Price too high');

  const bull = await assertCanListBull(userId, bullId);
  const bullData = bullListingSnapshot(bull);

  const listing = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.item.updateMany({ where: { equippedTo: bullId }, data: { equippedTo: null } });
    await tx.bull.delete({ where: { id: bullId } });
    const following = (await tx.playerProfile.findUnique({ where: { userId } }))?.followingBullIds ?? [];
    if (following.includes(bullId)) {
      await tx.playerProfile.update({
        where: { userId },
        data: { followingBullIds: following.filter((id) => id !== bullId) },
      });
    }
    return tx.marketListing.create({
      data: {
        sellerId: userId,
        type: 'bull',
        bullData: bullData as object,
        price: amount,
        status: 'open',
      },
      include: { seller: true },
    });
  });

  const payload = {
    id: listing.id,
    sellerId: listing.sellerId,
    sellerName: listing.seller.displayName,
    type: 'bull' as const,
    bull: bullData,
    price: listing.price,
    status: 'open' as const,
  };
  broadcast('listing_created', payload);
  const { broadcastPlayerBulls } = await import('../socket/index.js');
  await broadcastPlayerBulls(userId);
  return getMeResponse(userId);
}

export async function cancelMaterialListing(userId: string, listingId: string) {
  await requireNearInteractable(userId, 'market');
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'open') throw new Error('Listing not found');
  if (listing.sellerId !== userId) throw new Error('Not your listing');
  if (listing.type !== 'material' || !listing.mat || !listing.qty) throw new Error('Not a material listing');

  const mat = listing.mat as MatType;
  const p = await getProfile(userId);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.playerProfile.update({
      where: { userId },
      data: { [mat]: (p[mat] as number) + listing.qty! },
    });
    await tx.marketListing.delete({ where: { id: listingId } });
  });
  return getMeResponse(userId);
}

export async function cancelBullListing(userId: string, listingId: string) {
  await requireNearInteractable(userId, 'market');
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'open') throw new Error('Listing not found');
  if (listing.sellerId !== userId) throw new Error('Not your listing');
  if (listing.type !== 'bull' || !listing.bullData) throw new Error('Not a bull listing');

  const p = await getProfile(userId);
  const stableCount = await prisma.bull.count({ where: { ownerId: userId, location: 'stable' } });
  if (stableCount >= bullSlots(p.stableLevel)) throw new Error('No free stable slot');

  const bull = listing.bullData as Record<string, unknown>;
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.bull.create({
      data: {
        ownerId: userId,
        name: String(bull.name),
        level: Number(bull.level ?? 1),
        xp: Number(bull.xp ?? 0),
        speed: Number(bull.speed),
        stamina: Number(bull.stamina),
        accel: Number(bull.accel),
        temper: Number(bull.temper),
        coat: String(bull.coat),
        trait: String(bull.trait ?? 'normal'),
        rarity: String(bull.rarity ?? 'common'),
        energy: Number(bull.energy ?? 80),
        location: 'stable',
      },
    });
    await tx.marketListing.delete({ where: { id: listingId } });
  });

  const { broadcastPlayerBulls } = await import('../socket/index.js');
  await broadcastPlayerBulls(userId);
  return getMeResponse(userId);
}

export async function buyListing(userId: string, listingId: string) {
  await requireNearInteractable(userId, 'market');
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
    include: { seller: { include: { profile: true } } },
  });
  if (!listing || listing.status !== 'open') throw new Error('Listing not available');
  if (listing.type === 'gold') throw new Error('Use token payment for gold listings');
  if (listing.sellerId === userId) throw new Error('Cannot buy own listing');

  const buyer = await getProfile(userId);
  if (buyer.gold < listing.price) throw new Error('Not enough gold');

  if (listing.type === 'bull') {
    const stableCount = await prisma.bull.count({ where: { ownerId: userId, location: 'stable' } });
    if (stableCount >= bullSlots(buyer.stableLevel)) throw new Error('No free stable slots');
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.playerProfile.update({
      where: { userId },
      data: { gold: buyer.gold - listing.price },
    });
    const net = Math.floor(listing.price * (1 - MARKET_FEE));
    await tx.playerProfile.update({
      where: { userId: listing.sellerId },
      data: { gold: (listing.seller.profile?.gold ?? 0) + net },
    });

    if (listing.type === 'material' && listing.mat && listing.qty) {
      const f = listing.mat as MatType;
      const sellerP = listing.seller.profile!;
      await tx.playerProfile.update({
        where: { userId },
        data: { [f]: (buyer[f as 'hay'] as number) + listing.qty },
      });
      void sellerP;
    }

    if (listing.type === 'bull' && listing.bullData) {
      const bull = listing.bullData as Record<string, unknown>;
      await tx.bull.create({
        data: {
          ownerId: userId,
          name: String(bull.name),
          level: Number(bull.level ?? 1),
          xp: Number(bull.xp ?? 0),
          speed: Number(bull.speed),
          stamina: Number(bull.stamina),
          accel: Number(bull.accel),
          temper: Number(bull.temper),
          coat: String(bull.coat),
          trait: String(bull.trait ?? 'normal'),
          rarity: String(bull.rarity ?? 'common'),
          energy: Number(bull.energy ?? 80),
          location: 'stable',
        },
      });
    }

    if (listing.type === 'item' && listing.itemData) {
      const item = listing.itemData as Record<string, unknown>;
      await tx.item.create({
        data: {
          ownerId: userId,
          kind: String(item.kind ?? 'bull'),
          slot: String(item.slot),
          rarity: String(item.rarity),
          rarityColor: String(item.rarityColor),
          name: String(item.name),
          color: String(item.color),
          bonusStat: item.bonus ? (item.bonus as { stat: string }).stat : null,
          bonusAmt: item.bonus ? (item.bonus as { amt: number }).amt : null,
        },
      });
    }

    await tx.marketListing.update({
      where: { id: listingId },
      data: { status: 'sold', buyerId: userId, soldAt: new Date() },
    });
  });

  broadcast('listing_sold', { id: listingId, buyerId: userId });
  return getMeResponse(userId);
}

export async function buyNpcCatalog(userId: string, mat: MatType, price: number) {
  await requireNearInteractable(userId, 'market');
  const p = await getProfile(userId);
  if (p.gold < price) throw new Error('Not enough gold');
  await prisma.playerProfile.update({
    where: { userId },
    data: { gold: p.gold - price, [mat]: (p[mat] as number) + 10 },
  });
  return getMeResponse(userId);
}

export async function buyShopBull(userId: string, bullData: Record<string, unknown>, price: number) {
  await requireNearInteractable(userId, 'market');
  const p = await getProfile(userId);
  const count = await prisma.bull.count({ where: { ownerId: userId, location: 'stable' } });
  if (count >= bullSlots(p.stableLevel)) throw new Error('No free stable slots');
  if (p.gold < price) throw new Error('Not enough gold');

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { gold: p.gold - price } }),
    prisma.bull.create({
      data: {
        ownerId: userId,
        name: String(bullData.name),
        speed: Number(bullData.speed),
        stamina: Number(bullData.stamina),
        accel: Number(bullData.accel),
        temper: Number(bullData.temper),
        coat: String(bullData.coat),
        energy: 80,
        location: 'stable',
      },
    }),
  ]);
  return getMeResponse(userId);
}

export async function tickEnergy(userId: string) {
  await completeBreed(userId);
}

export async function tickAllEnergy() {
  const profiles = await prisma.playerProfile.findMany({
    include: { user: { include: { bulls: true } } },
  });
  for (const p of profiles) {
    const rate = energyPerTick(p.stableLevel);
    for (const b of p.user.bulls) {
      if (b.energy < BULL_MAX_ENERGY) {
        await prisma.bull.update({
          where: { id: b.id },
          data: { energy: Math.min(BULL_MAX_ENERGY, b.energy + rate) },
        });
      }
    }
  }
}
