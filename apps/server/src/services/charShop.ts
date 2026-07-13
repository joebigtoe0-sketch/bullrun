import {
  STORE_CATALOG,
  WHEEL_GOLD_TIERS,
  WHEEL_JACKPOT_WEIGHT,
  WHEEL_JACKPOT_CLOTHING,
  WHEEL_MIN_TOKENS,
} from '@bullrace/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { getMeResponse } from './player.js';
import { requireNearInteractable } from './proximity.js';
import { broadcast } from './game.js';
import { getTokenBalance, isTokenGateConfigured } from '../lib/solana.js';

async function getProfile(userId: string) {
  const p = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!p) throw new Error('Profile not found');
  return p;
}

/* ---------------- character equipment ---------------- */

export async function equipCharItem(userId: string, itemId: number) {
  const item = await prisma.item.findFirst({ where: { id: itemId, ownerId: userId } });
  if (!item) throw new Error('Item not found');
  if (item.kind !== 'char') throw new Error('That is bull gear — equip it from the stable');

  await prisma.$transaction([
    prisma.item.updateMany({
      where: { ownerId: userId, kind: 'char', slot: item.slot, equippedChar: true },
      data: { equippedChar: false },
    }),
    prisma.item.update({ where: { id: itemId }, data: { equippedChar: true } }),
  ]);
  return getMeResponse(userId);
}

export async function unequipCharItem(userId: string, itemId: number) {
  await prisma.item.updateMany({
    where: { id: itemId, ownerId: userId, kind: 'char' },
    data: { equippedChar: false },
  });
  return getMeResponse(userId);
}

/* ---------------- general store ---------------- */

export async function buyStoreItem(userId: string, sku: string) {
  await requireNearInteractable(userId, 'shop');
  const def = STORE_CATALOG.find((d) => d.sku === sku);
  if (!def) throw new Error('Item not sold here');

  const p = await getProfile(userId);
  if (p.gold < def.price) throw new Error(`Not enough gold — costs ${def.price}g`);

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { gold: p.gold - def.price } }),
    prisma.item.create({
      data: {
        ownerId: userId,
        kind: 'char',
        slot: def.slot,
        rarity: def.rarity,
        rarityColor: rarityColorOf(def.rarity),
        name: def.name,
        color: def.color,
        bonusStat: def.bonus.stat,
        bonusAmt: def.bonus.amt,
      },
    }),
  ]);
  return getMeResponse(userId);
}

function rarityColorOf(rarity: string): string {
  const map: Record<string, string> = {
    Common: '#c9b896',
    Uncommon: '#7dc24f',
    Rare: '#5fb4d8',
    Epic: '#c86ad4',
    Legendary: '#f2b23a',
  };
  return map[rarity] ?? '#c9b896';
}

/* ---------------- daily wheel ---------------- */

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function nextWheelSpinAt(lastSpin: Date | null): number {
  if (!lastSpin) return 0;
  const now = new Date();
  if (utcDayKey(lastSpin) !== utcDayKey(now)) return 0;
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime();
}

/**
 * Deterministic daily jackpot item — same for everyone on a given UTC day,
 * and exclusive to the wheel ("Champion" bull gear can't be forged; the
 * clothing pool isn't sold in the store).
 */
export function todaysJackpot() {
  const day = Math.floor(Date.now() / 86_400_000);
  const rng = (n: number) => {
    const x = Math.sin(day * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  // alternate between char clothing and high-rarity bull gear day by day
  if (day % 2 === 0) {
    const def = WHEEL_JACKPOT_CLOTHING[day % WHEEL_JACKPOT_CLOTHING.length];
    return {
      kind: 'char' as const,
      slot: def.slot as string,
      rarity: def.rarity as string,
      rarityColor: rarityColorOf(def.rarity),
      name: def.name,
      color: def.color,
      bonusStat: def.bonus.stat as string,
      bonusAmt: def.bonus.amt,
    };
  }
  const slots = ['coat', 'horns', 'hooves', 'tail', 'accessory'] as const;
  const nouns: Record<(typeof slots)[number], string> = {
    coat: 'Coat',
    horns: 'Horns',
    hooves: 'Hooves',
    tail: 'Tail Wrap',
    accessory: 'Harness',
  };
  const slot = slots[Math.floor(rng(1) * slots.length)];
  const rarity = day % 3 === 0 ? 'Legendary' : 'Epic';
  const stats = ['speed', 'stamina', 'accel'] as const;
  const stat = stats[Math.floor(rng(2) * stats.length)];
  const amt = rarity === 'Legendary' ? 180 : 130; // a notch above the best forge rolls
  return {
    kind: 'bull' as const,
    slot: slot as string,
    rarity,
    rarityColor: rarityColorOf(rarity),
    name: `Champion ${nouns[slot]}`,
    color: rarityColorOf(rarity),
    bonusStat: stat as string,
    bonusAmt: amt,
  };
}

export interface WheelSpinResult {
  outcome: 'gold' | 'jackpot';
  gold?: number;
  itemName?: string;
  itemRarity?: string;
  /** wheel segment index the client should land on */
  segment: number;
  me: Awaited<ReturnType<typeof getMeResponse>>;
}

export async function spinWheel(userId: string): Promise<WheelSpinResult> {
  await requireNearInteractable(userId, 'wheel');
  const p = await getProfile(userId);

  const nextAt = nextWheelSpinAt(p.lastWheelSpinAt);
  if (nextAt > Date.now()) throw new Error('Already spun today — come back tomorrow');

  // wheel needs a linked wallet holding WHEEL_MIN_TOKENS (balance check skipped when no token configured, e.g. local dev)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.walletAddress) throw new Error('Connect your wallet in Profile to spin the wheel');
  if (isTokenGateConfigured()) {
    const balance = await getTokenBalance(user.walletAddress);
    if (balance < WHEEL_MIN_TOKENS) {
      throw new Error(`Hold ${WHEEL_MIN_TOKENS.toLocaleString()} tokens to spin — you have ${Math.floor(balance).toLocaleString()}`);
    }
  }

  const totalWeight = WHEEL_GOLD_TIERS.reduce((s, t) => s + t.weight, 0) + WHEEL_JACKPOT_WEIGHT;
  let roll = Math.random() * totalWeight;
  let tierIdx = -1; // -1 = jackpot
  for (let i = 0; i < WHEEL_GOLD_TIERS.length; i++) {
    if (roll < WHEEL_GOLD_TIERS[i].weight) {
      tierIdx = i;
      break;
    }
    roll -= WHEEL_GOLD_TIERS[i].weight;
  }

  const now = new Date();
  if (tierIdx === -1) {
    const itemData = todaysJackpot();
    await prisma.$transaction([
      prisma.playerProfile.update({
        where: { userId },
        data: { lastWheelSpinAt: now },
      }),
      prisma.item.create({ data: { ownerId: userId, ...itemData } }),
    ]);
    return {
      outcome: 'jackpot',
      itemName: itemData.name,
      itemRarity: itemData.rarity,
      segment: WHEEL_GOLD_TIERS.length,
      me: await getMeResponse(userId),
    };
  }

  const tier = WHEEL_GOLD_TIERS[tierIdx];
  const gold = tier.min + Math.floor(Math.random() * (tier.max - tier.min + 1));
  await prisma.playerProfile.update({
    where: { userId },
    data: { lastWheelSpinAt: now, gold: p.gold + gold },
  });
  return { outcome: 'gold', gold, segment: tierIdx, me: await getMeResponse(userId) };
}

/* ---------------- item market listings ---------------- */

export async function listItem(userId: string, itemId: number, price: number) {
  await requireNearInteractable(userId, 'market');
  const amount = Math.floor(price);
  if (amount < 1) throw new Error('Price must be at least 1g');
  if (amount > 1_000_000) throw new Error('Price too high');

  const item = await prisma.item.findFirst({ where: { id: itemId, ownerId: userId } });
  if (!item) throw new Error('Item not found');
  if (item.equippedTo != null) throw new Error('Unequip it from your bull first');
  if (item.equippedChar) throw new Error('Take it off first');

  const itemData = {
    kind: item.kind,
    slot: item.slot,
    rarity: item.rarity,
    rarityColor: item.rarityColor,
    name: item.name,
    color: item.color,
    bonus: item.bonusStat && item.bonusAmt != null ? { stat: item.bonusStat, amt: item.bonusAmt } : null,
  };

  const listing = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.item.delete({ where: { id: item.id } });
    return tx.marketListing.create({
      data: {
        sellerId: userId,
        type: 'item',
        itemData: itemData as object,
        price: amount,
        status: 'open',
      },
      include: { seller: true },
    });
  });

  broadcast('listing_created', {
    id: listing.id,
    sellerId: listing.sellerId,
    sellerName: listing.seller.displayName,
    type: 'item' as const,
    item: itemData,
    price: listing.price,
    status: 'open' as const,
  });
  return getMeResponse(userId);
}

export async function cancelItemListing(userId: string, listingId: string) {
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.sellerId !== userId || listing.type !== 'item') throw new Error('Listing not found');
  if (listing.status !== 'open') throw new Error('Listing not open');

  const item = listing.itemData as Record<string, unknown>;
  await prisma.$transaction([
    prisma.marketListing.update({
      where: { id: listingId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    }),
    prisma.item.create({
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
    }),
  ]);
  broadcast('listing_cancelled', { id: listingId });
  return getMeResponse(userId);
}
