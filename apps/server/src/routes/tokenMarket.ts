import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { MARKET_FEE } from '@bullrace/shared';
import { prisma } from '../db.js';
import { requireNearInteractable } from '../services/proximity.js';
import { getMeResponse } from '../services/player.js';
import { broadcast } from '../services/game.js';
import {
  getTokenBalance,
  getMintDecimals,
  verifyPurchaseTx,
  toBaseUnits,
  paymentsConfigured,
  TREASURY_WALLET,
  MINT_ADDRESS,
} from '../lib/solana.js';

const RESERVE_MS = 120_000;
const CANCEL_COOLDOWN_MS = 30_000;

import { buildGoldListingMessage } from '@bullrace/shared';

function verifySignature(message: string, signature: string, wallet: string): boolean {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(wallet),
    );
  } catch {
    return false;
  }
}

function tokenPriceNum(p: Prisma.Decimal | null | undefined): number {
  if (!p) return 0;
  return Number(p.toString());
}

function mapGoldListing(l: {
  id: string;
  sellerId: string;
  seller: { displayName: string };
  qty: number | null;
  tokenPrice: Prisma.Decimal | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: l.id,
    sellerId: l.sellerId,
    sellerName: l.seller.displayName,
    type: 'gold' as const,
    qty: l.qty ?? 0,
    tokenPrice: tokenPriceNum(l.tokenPrice),
    status: l.status,
    createdAt: l.createdAt.getTime(),
  };
}

export async function tokenMarketRoutes(app: FastifyInstance) {
  app.get('/market/gold', async () => {
    const rows = await prisma.marketListing.findMany({
      where: { type: 'gold', status: 'open' },
      include: { seller: true },
      orderBy: [{ tokenPrice: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });
    return rows.map(mapGoldListing);
  });

  app.post<{
    Body: { goldQty: number; tokenPrice: number; signature: string; message: string };
  }>('/market/list-gold', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const { goldQty, tokenPrice, signature, message } = req.body;
    const roundedPrice = Math.round(tokenPrice * 1e6) / 1e6;

    if (!goldQty || goldQty < 1 || !roundedPrice || roundedPrice <= 0) {
      return reply.status(400).send({ error: 'Invalid gold quantity or token price' });
    }
    if (!signature || !message) {
      return reply.status(400).send({ error: 'Wallet signature required' });
    }

    try {
      await requireNearInteractable(userId, 'market');
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.walletAddress) {
      return reply.status(400).send({ error: 'Wallet required' });
    }

    const expected = buildGoldListingMessage({
      wallet: user.walletAddress,
      goldQty,
      tokenPrice: roundedPrice,
    });
    if (message !== expected || !verifySignature(message, signature, user.walletAddress)) {
      return reply.status(401).send({ error: 'Signature verification failed' });
    }

    try {
      const listing = await prisma.$transaction(async (tx) => {
        const profile = await tx.playerProfile.findUnique({ where: { userId } });
        if (!profile || profile.gold < goldQty) throw new Error('INSUFFICIENT');

        await tx.playerProfile.update({
          where: { userId },
          data: { gold: profile.gold - goldQty },
        });

        return tx.marketListing.create({
          data: {
            sellerId: userId,
            type: 'gold',
            qty: goldQty,
            price: 0,
            tokenPrice: new Prisma.Decimal(roundedPrice),
            status: 'open',
          },
          include: { seller: true },
        });
      });

      const payload = mapGoldListing(listing);
      broadcast('listing_created', payload);
      const me = await getMeResponse(userId);
      return { listing: payload, me };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'INSUFFICIENT') return reply.status(400).send({ error: 'Not enough gold' });
      throw e;
    }
  });

  app.post<{ Body: { listingId: string } }>('/market/gold/cancel', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const { listingId } = req.body;

    try {
      await requireNearInteractable(userId, 'market');
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }

    const listing = await prisma.marketListing.findFirst({
      where: { id: listingId, sellerId: userId, type: 'gold' },
    });
    if (!listing) return reply.status(404).send({ error: 'Listing not found' });
    if (listing.status === 'cancelling') {
      return { status: 'cancelling', cooldownUntil: listing.cooldownUntil?.getTime() ?? null };
    }
    if (listing.status !== 'open' && listing.status !== 'reserved') {
      return reply.status(400).send({ error: 'Listing cannot be cancelled' });
    }

    const now = Date.now();
    const cooldownUntil = listing.status === 'reserved' && listing.reservedUntil
      ? new Date(Math.max(listing.reservedUntil.getTime(), now + CANCEL_COOLDOWN_MS))
      : new Date(now + CANCEL_COOLDOWN_MS);

    const updated = await prisma.marketListing.updateMany({
      where: { id: listingId, status: { in: ['open', 'reserved'] } },
      data: { status: 'cancelling', cooldownUntil },
    });
    if (updated.count === 0) return reply.status(409).send({ error: 'Listing state changed' });

    return { status: 'cancelling', cooldownUntil: cooldownUntil.getTime() };
  });

  app.post<{ Body: { listingId: string } }>('/market/gold/reserve', async (req, reply) => {
    if (!paymentsConfigured()) {
      return reply.status(503).send({ error: 'Token payments not configured on server' });
    }

    const userId = (req.user as { sub: string }).sub;
    const { listingId } = req.body;

    try {
      await requireNearInteractable(userId, 'market');
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }

    const buyer = await prisma.user.findUnique({ where: { id: userId } });
    if (!buyer?.walletAddress) {
      return reply.status(400).send({ error: 'Wallet required' });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const listing = await tx.marketListing.findFirst({
          where: { id: listingId, type: 'gold', status: 'open' },
        });
        if (!listing) throw new Error('NONE');
        if (listing.sellerId === buyer.id) throw new Error('OWN');

        const price = tokenPriceNum(listing.tokenPrice);
        const total = Math.round(price * (1 + MARKET_FEE) * 1e6) / 1e6;
        const balance = await getTokenBalance(buyer.walletAddress!);
        if (balance < total) throw new Error('BALANCE');

        const claimed = await tx.marketListing.updateMany({
          where: { id: listingId, status: 'open' },
          data: {
            status: 'reserved',
            reservedById: buyer.id,
            reservedUntil: new Date(Date.now() + RESERVE_MS),
          },
        });
        if (claimed.count === 0) throw new Error('RACE');

        const seller = await tx.user.findUnique({ where: { id: listing.sellerId } });
        if (!seller?.walletAddress) throw new Error('SELLER');

        return { listing, sellerWallet: seller.walletAddress, price, total, goldQty: listing.qty ?? 0 };
      });

      const decimals = await getMintDecimals();
      const feeAmount = Math.round(result.price * MARKET_FEE * 1e6) / 1e6;

      return {
        listingId,
        goldQty: result.goldQty,
        sellerWallet: result.sellerWallet,
        treasuryWallet: TREASURY_WALLET,
        mint: MINT_ADDRESS,
        decimals,
        sellerAmount: result.price,
        feeAmount,
        total: result.total,
        reservedUntil: Date.now() + RESERVE_MS,
      };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'NONE') return reply.status(404).send({ error: 'Listing not available' });
      if (msg === 'OWN') return reply.status(400).send({ error: 'Cannot buy your own listing' });
      if (msg === 'BALANCE') return reply.status(402).send({ error: 'Insufficient token balance' });
      if (msg === 'RACE') return reply.status(409).send({ error: 'Listing just reserved — try again' });
      if (msg === 'SELLER') return reply.status(409).send({ error: 'Seller wallet unavailable' });
      throw e;
    }
  });

  app.post<{ Body: { listingId: string; signature: string } }>('/market/gold/confirm', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const { listingId, signature } = req.body;

    const buyer = await prisma.user.findUnique({ where: { id: userId } });
    if (!buyer?.walletAddress) {
      return reply.status(400).send({ error: 'Wallet required' });
    }

    const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.type !== 'gold') {
      return reply.status(404).send({ error: 'Listing not found' });
    }
    if (listing.status === 'sold') {
      if (!listing.buyerId || listing.buyerId === buyer.id) return { status: 'sold' };
      return reply.status(409).send({ error: 'Listing already sold' });
    }
    if (listing.status === 'cancelled') {
      return reply.status(409).send({ error: 'Listing was cancelled' });
    }
    if (listing.reservedById && listing.reservedById !== buyer.id) {
      return reply.status(403).send({ error: 'Not your reservation' });
    }

    const existing = await prisma.marketListing.findUnique({ where: { txSignature: signature } });
    if (existing && existing.id !== listingId) {
      return reply.status(409).send({ error: 'Signature already used' });
    }

    const seller = await prisma.user.findUnique({ where: { id: listing.sellerId } });
    if (!seller?.walletAddress) {
      return reply.status(409).send({ error: 'Seller wallet unavailable' });
    }

    const decimals = await getMintDecimals();
    const price = tokenPriceNum(listing.tokenPrice);
    const feeAmount = Math.round(price * MARKET_FEE * 1e6) / 1e6;
    const ok = await verifyPurchaseTx(signature, {
      buyer: buyer.walletAddress,
      sellerWallet: seller.walletAddress,
      treasury: TREASURY_WALLET,
      sellerBaseUnits: toBaseUnits(price, decimals),
      feeBaseUnits: toBaseUnits(feeAmount, decimals),
    });

    if (!ok) {
      return reply.status(409).send({ error: 'Transaction not confirmed yet', pending: true });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const flipped = await tx.marketListing.updateMany({
          where: {
            id: listingId,
            status: { in: ['reserved', 'cancelling', 'open'] },
            OR: [{ reservedById: buyer.id }, { reservedById: null }],
          },
          data: {
            status: 'sold',
            buyerId: buyer.id,
            txSignature: signature,
            soldAt: new Date(),
          },
        });
        if (flipped.count === 0) throw new Error('RACE');

        const goldQty = listing.qty ?? 0;
        const profile = await tx.playerProfile.findUnique({ where: { userId: buyer.id } });
        await tx.playerProfile.update({
          where: { userId: buyer.id },
          data: { gold: (profile?.gold ?? 0) + goldQty },
        });
      });

      broadcast('listing_sold', { id: listingId, buyerId: buyer.id });
      const me = await getMeResponse(buyer.id);
      return { status: 'sold', me };
    } catch (e) {
      if ((e as Error).message === 'RACE') {
        return reply.status(409).send({ error: 'Listing already settled' });
      }
      throw e;
    }
  });
}

async function sweepGoldMarket(): Promise<void> {
  const now = new Date();
  try {
    await prisma.marketListing.updateMany({
      where: { type: 'gold', status: 'reserved', reservedUntil: { lt: now } },
      data: { status: 'open', reservedById: null, reservedUntil: null },
    });

    await prisma.marketListing.updateMany({
      where: { type: 'gold', status: 'cancelling', reservedUntil: { lt: now } },
      data: { reservedById: null, reservedUntil: null },
    });

    const toReturn = await prisma.marketListing.findMany({
      where: { type: 'gold', status: 'cancelling', cooldownUntil: { lt: now } },
    });

    for (const listing of toReturn) {
      try {
        await prisma.$transaction(async (tx) => {
          const flipped = await tx.marketListing.updateMany({
            where: { id: listing.id, status: 'cancelling' },
            data: { status: 'cancelled', cancelledAt: new Date() },
          });
          if (flipped.count === 0) return;

          const goldQty = listing.qty ?? 0;
          const profile = await tx.playerProfile.findUnique({ where: { userId: listing.sellerId } });
          await tx.playerProfile.update({
            where: { userId: listing.sellerId },
            data: { gold: (profile?.gold ?? 0) + goldQty },
          });
        });
      } catch (err) {
        console.error('[gold-market] sweeper return failed', listing.id, err);
      }
    }
  } catch (err) {
    console.error('[gold-market] sweeper failed', err);
  }
}

let sweeperTimer: ReturnType<typeof setInterval> | null = null;

export function startGoldMarketSweeper(): void {
  if (sweeperTimer) return;
  sweeperTimer = setInterval(() => { void sweepGoldMarket(); }, 15_000);
  void sweepGoldMarket();
}
