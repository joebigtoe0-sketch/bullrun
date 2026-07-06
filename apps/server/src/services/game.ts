import type { Server as SocketServer } from 'socket.io';
import {
  BREED_COST,
  BREED_DURATION_MS,
  GATHER_DURATION_MS,
  MARKET_FEE,
  MARKET_LIST_QTY,
  NODE_RESPAWN_MS,
  RACE_ENTRY_ENERGY,
  RACE_ENTRY_FEE,
  REST_COST,
  REST_ENERGY,
  TRAIN_HAY_COST,
  buildWorld,
  bullSlots,
  energyRegen,
  makeItem,
  nodeId,
  rollRarityIndex,
  statCap,
  stableGoldNeed,
  stableWoodNeed,
  type MatType,
  type StatType,
} from '@bullrun/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { getMeResponse, mapBull } from './player.js';
import { requireNearInteractable } from './proximity.js';

type Io = SocketServer | null;
let io: Io = null;

export function setIo(server: SocketServer) {
  io = server;
}

function broadcast(event: string, data: unknown) {
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
  if (bull[stat] >= cap) throw new Error(`${stat} capped at ${cap}`);
  if (profile.hay < TRAIN_HAY_COST) throw new Error('Need 6 hay');

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { hay: profile.hay - TRAIN_HAY_COST } }),
    prisma.bull.update({ where: { id: bullId }, data: { [stat]: bull[stat] + 1 } }),
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
  if (bull.energy >= 100) throw new Error('Already rested');

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { gold: profile.gold - REST_COST } }),
    prisma.bull.update({ where: { id: bullId }, data: { energy: Math.min(100, bull.energy + REST_ENERGY) } }),
  ]);
  return getMeResponse(userId);
}

export async function upgradeStable(userId: string) {
  await requireNearInteractable(userId, 'stable');
  const p = await getProfile(userId);
  if (p.wood < 5) throw new Error('Need 5 wood');
  let wood = p.stableWood + 5;
  let matsWood = p.wood - 5;
  let gold = p.gold;
  let level = p.stableLevel;

  const need = stableWoodNeed(level);
  const goldNeed = stableGoldNeed(level);
  if (wood >= need) {
    if (gold < goldNeed) throw new Error(`Need ${goldNeed}g to level up`);
    gold -= goldNeed;
    level += 1;
    wood = 0;
  }

  await prisma.playerProfile.update({
    where: { userId },
    data: { wood: matsWood, stableWood: wood, gold, stableLevel: level },
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
  if (p.gold < BREED_COST) throw new Error('Need 200g');

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

  const [a, b] = await Promise.all([
    prisma.bull.findUnique({ where: { id: p.breedingAId } }),
    prisma.bull.findUnique({ where: { id: p.breedingBId } }),
  ]);
  if (!a || !b) return null;

  const mix = (k: 'speed' | 'stamina' | 'accel' | 'temper') =>
    Math.max(1, Math.round((a[k] + b[k]) / 2 + (Math.random() * 3 - 1)));
  const names = ['Rowdy', 'Biscuit', 'Comet', 'Waffle', 'Tornado', 'Mocha', 'Zippy', 'Boulder'];

  await prisma.$transaction([
    prisma.bull.create({
      data: {
        ownerId: userId,
        name: names[Math.floor(Math.random() * names.length)],
        speed: mix('speed'),
        stamina: mix('stamina'),
        accel: mix('accel'),
        temper: mix('temper'),
        energy: 60,
        coat: Math.random() < 0.5 ? a.coat : b.coat,
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
  if (p.ore < oreAmount || oreAmount < 50) throw new Error('Not enough ore');

  const rarIdx = rollRarityIndex(oreAmount);
  const item = makeItem(rarIdx, p.nextItemId);

  await prisma.$transaction([
    prisma.playerProfile.update({
      where: { userId },
      data: { ore: p.ore - oreAmount, nextItemId: p.nextItemId + 1 },
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

  const qty = 2 + Math.floor(Math.random() * 3);
  const mat = node.mat as MatType;
  const deadUntil = new Date(Date.now() + NODE_RESPAWN_MS);

  const p = await getProfile(userId);
  const matField = mat === 'hay' ? 'hay' : mat === 'ore' ? 'ore' : 'wood';

  await prisma.$transaction([
    prisma.worldNode.update({ where: { id: resolvedId }, data: { deadUntil } }),
    prisma.playerProfile.update({ where: { userId }, data: { [matField]: (p[matField as 'hay'] as number) + qty } }),
  ]);

  broadcast('node_depleted', { id: resolvedId, deadUntil: deadUntil.getTime() });
  return { qty, mat, me: await getMeResponse(userId) };
}

export async function enterRace(userId: string, bullId: number) {
  await requireNearInteractable(userId, 'race');
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
  if (userEntries > 0) throw new Error('One bull per race');
  if (bull.energy < RACE_ENTRY_ENERGY) throw new Error('Need 30 energy');
  if (profile.gold < RACE_ENTRY_FEE) throw new Error('Need 50g');

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { gold: profile.gold - RACE_ENTRY_FEE } }),
    prisma.bull.update({ where: { id: bullId }, data: { energy: bull.energy - RACE_ENTRY_ENERGY } }),
    prisma.raceEntry.create({
      data: { raceId: race.id, userId, bullId, isNpc: false, bullData: bull },
    }),
  ]);
  return getMeResponse(userId);
}

export async function placeBet(userId: string, targetBullId: string, targetName: string, amount: number, odds: number) {
  await requireNearInteractable(userId, 'bet');
  const race = await prisma.race.findFirst({ where: { status: 'scheduled' }, orderBy: { startAt: 'asc' } });
  if (!race) throw new Error('No scheduled race');

  const existing = await prisma.bet.findFirst({ where: { raceId: race.id, userId } });
  if (existing) throw new Error('One bet per race');

  const p = await getProfile(userId);
  if (p.gold < amount) throw new Error('Not enough gold');

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { gold: p.gold - amount } }),
    prisma.bet.create({ data: { raceId: race.id, userId, targetBullId, targetName, amount, odds } }),
  ]);
  return getMeResponse(userId);
}

export async function listMaterial(userId: string, mat: MatType, pricePerUnit: number) {
  await requireNearInteractable(userId, 'market');
  const p = await getProfile(userId);
  const field = mat;
  if ((p[field] as number) < MARKET_LIST_QTY) throw new Error(`Need ${MARKET_LIST_QTY} ${mat}`);

  const listing = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.playerProfile.update({
      where: { userId },
      data: { [field]: (p[field] as number) - MARKET_LIST_QTY },
    });
    return tx.marketListing.create({
      data: {
        sellerId: userId,
        type: 'material',
        mat,
        qty: MARKET_LIST_QTY,
        price: pricePerUnit * MARKET_LIST_QTY,
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
    qty: MARKET_LIST_QTY,
    price: listing.price,
    status: 'open' as const,
  };
  broadcast('listing_created', payload);
  return getMeResponse(userId);
}

export async function buyListing(userId: string, listingId: string) {
  await requireNearInteractable(userId, 'market');
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
    include: { seller: { include: { profile: true } } },
  });
  if (!listing || listing.status !== 'open') throw new Error('Listing not available');
  if (listing.sellerId === userId) throw new Error('Cannot buy own listing');

  const buyer = await getProfile(userId);
  if (buyer.gold < listing.price) throw new Error('Not enough gold');

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
          speed: Number(bull.speed),
          stamina: Number(bull.stamina),
          accel: Number(bull.accel),
          temper: Number(bull.temper),
          coat: String(bull.coat),
          energy: Number(bull.energy ?? 80),
        },
      });
    }

    if (listing.type === 'item' && listing.itemData) {
      const item = listing.itemData as Record<string, unknown>;
      await tx.item.create({
        data: {
          ownerId: userId,
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
  const p = await prisma.playerProfile.findUnique({ where: { userId }, include: { user: { include: { bulls: true } } } });
  if (!p) return;
  const regen = energyRegen(p.stableLevel);
  for (const b of p.user.bulls) {
    if (b.energy < 100) {
      await prisma.bull.update({
        where: { id: b.id },
        data: { energy: Math.min(100, b.energy + regen) },
      });
    }
  }
  await completeBreed(userId);
}
