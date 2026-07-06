import type { FastifyInstance } from 'fastify';
import type { Item as PrismaItem, MarketListing } from '@prisma/client';
import { hashPassword, verifyPassword } from '../auth.js';
import { prisma } from '../db.js';
import { createStarterUser, getMeResponse } from '../services/player.js';
import * as game from '../services/game.js';
import * as pasture from '../services/pasture.js';
import * as bulls from '../services/bulls.js';
import { odds, raceScore, type Bull, type GameItem } from '@bullrun/shared';

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { username: string; password: string; displayName?: string } }>('/auth/register', async (req, reply) => {
    const { username, password, displayName } = req.body;
    if (!username || !password || username.length < 3) {
      return reply.status(400).send({ error: 'Username and password required (min 3 chars)' });
    }
    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existing) return reply.status(409).send({ error: 'Username taken' });

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        passwordHash: await hashPassword(password),
        displayName: displayName || username,
      },
    });
    await createStarterUser(user.id);
    const token = app.jwt.sign({ sub: user.id });
    return { token, user: { id: user.id, username: user.username, displayName: user.displayName } };
  });

  app.post<{ Body: { username: string; password: string } }>('/auth/login', async (req, reply) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const token = app.jwt.sign({ sub: user.id });
    return { token, user: { id: user.id, username: user.username, displayName: user.displayName } };
  });
}

export async function gameRoutes(app: FastifyInstance) {
  const PUBLIC = new Set(['/health', '/auth/register', '/auth/login']);

  app.addHook('preHandler', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (PUBLIC.has(path)) return;
    await app.authenticate(request, reply);
  });

  app.get('/me', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    await game.tickEnergy(userId);
    const me = await getMeResponse(userId);
    if (!me) return reply.status(404).send({ error: 'Player profile not found' });
    return me;
  });

  app.patch<{ Body: { x: number; y: number } }>('/me/position', async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const { x, y } = req.body;
    await prisma.playerProfile.update({ where: { userId }, data: { posX: x, posY: y } });
    return { ok: true };
  });

  app.post<{ Body: { bullId: number; stat: string } }>('/bulls/train', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.trainBull(userId, req.body.bullId, req.body.stat as 'speed');
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { bullId: number } }>('/bulls/rest', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.restBull(userId, req.body.bullId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { bullId: number; name: string } }>('/bulls/rename', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.renameBull(userId, req.body.bullId, req.body.name);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { bullAId: number; bullBId: number } }>('/bulls/breed', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.breedBulls(userId, req.body.bullAId, req.body.bullBId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { bullId: number } }>('/bulls/delete', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await bulls.deleteBull(userId, req.body.bullId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { bullId: number } }>('/bulls/follow', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await bulls.takeBullFollow(userId, req.body.bullId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { bullId: number } }>('/bulls/to-stable', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await bulls.depositBullStable(userId, req.body.bullId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { bullId: number; plotId: number } }>('/bulls/to-den', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await bulls.depositBullDen(userId, req.body.bullId, req.body.plotId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post('/stable/upgrade', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.upgradeStable(userId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { oreAmount: number } }>('/forge', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.forgeItem(userId, req.body.oreAmount);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { itemId: number; bullId: number } }>('/items/equip', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.equipItem(userId, req.body.itemId, req.body.bullId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { itemId: number } }>('/items/unequip', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.unequipItem(userId, req.body.itemId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { nodeId: string; x?: number; y?: number } }>('/gather/complete', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.completeGather(userId, req.body.nodeId, req.body.x, req.body.y);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { bullId: number } }>('/race/enter', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.enterRace(userId, req.body.bullId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { targetBullId: string; targetName: string; amount: number; odds: number } }>('/race/bet', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.placeBet(userId, req.body.targetBullId, req.body.targetName, req.body.amount, req.body.odds);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.get('/race/odds', async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const me = await getMeResponse(userId);
    if (!me?.race) return { field: [], odds: [] };

    const race = await prisma.race.findUnique({
      where: { id: me.race.id },
      include: { entries: { include: { user: true } } },
    });
    if (!race) return { field: [], odds: [] };

    const field: Bull[] = [];
    for (const e of race.entries) {
      if (e.bullId) {
        const b = await prisma.bull.findUnique({ where: { id: e.bullId } });
        if (b) field.push({ ...b, owner: e.user?.displayName || 'Player' } as Bull & { owner: string });
      }
    }
    const npcs = (race.field as Array<Record<string, unknown>>).map((n, i) => ({
      ...n,
      id: `npc${i}`,
      isNpc: true,
    }));
    const all = [...field, ...npcs].slice(0, 6) as Array<Bull & { isNpc?: boolean; owner?: string }>;
    const items = await prisma.item.findMany({ where: { ownerId: userId } });
    const mappedItems = items.map((it: PrismaItem) => ({
      id: it.id,
      slot: it.slot as GameItem['slot'],
      rarity: it.rarity as GameItem['rarity'],
      rarityColor: it.rarityColor,
      name: it.name,
      color: it.color,
      bonus: it.bonusStat ? { stat: it.bonusStat as 'speed', amt: it.bonusAmt ?? 0 } : null,
      equippedTo: it.equippedTo,
    }));
    const raceField = all.map((b) => ({
      ...b,
      speed: b.isNpc ? b.speed : undefined,
    }));
    void raceScore;
    const oddsArr = odds(all as Parameters<typeof odds>[0]);
    return { field: all, odds: oddsArr };
  });

  app.post<{ Body: { mat: string; pricePerUnit: number; qty: number } }>('/market/list', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.listMaterial(userId, req.body.mat as 'hay', req.body.pricePerUnit, req.body.qty);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.get('/market', async () => {
    const listings = await prisma.marketListing.findMany({
      where: { status: 'open' },
      include: { seller: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return listings.map((l: MarketListing & { seller: { displayName: string } }) => ({
      id: l.id,
      sellerId: l.sellerId,
      sellerName: l.seller.displayName,
      type: l.type,
      mat: l.mat,
      qty: l.qty,
      item: l.itemData,
      bull: l.bullData,
      price: l.price,
      status: l.status,
    }));
  });

  app.post<{ Body: { listingId: string } }>('/market/buy', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.buyListing(userId, req.body.listingId);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { mat: string; price: number } }>('/market/buy-npc', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.buyNpcCatalog(userId, req.body.mat as 'hay', req.body.price);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { bull: Record<string, unknown>; price: number } }>('/market/buy-bull', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await game.buyShopBull(userId, req.body.bull, req.body.price);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.get('/pastures', async () => pasture.listPastures());

  app.post<{ Params: { id: string } }>('/pastures/:id/buy', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await pasture.buyPasture(userId, Number(req.params.id));
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Params: { id: string } }>('/pastures/:id/upgrade', async (req, reply) => {
    try {
      const userId = (req.user as { sub: string }).sub;
      return await pasture.upgradePasture(userId, Number(req.params.id));
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.patch<{ Body: { helpSeen?: boolean; betAmount?: number; forgeOre?: number; breedSel?: number[]; listPrice?: Record<string, number> } }>('/me/settings', async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const { helpSeen, betAmount, forgeOre, breedSel, listPrice } = req.body;
    await prisma.playerProfile.update({
      where: { userId },
      data: {
        ...(helpSeen !== undefined && { helpSeen }),
        ...(betAmount !== undefined && { betAmount }),
        ...(forgeOre !== undefined && { forgeOre }),
        ...(breedSel !== undefined && { breedSel }),
        ...(listPrice?.hay !== undefined && { listHay: listPrice.hay }),
        ...(listPrice?.ore !== undefined && { listOre: listPrice.ore }),
        ...(listPrice?.wood !== undefined && { listWood: listPrice.wood }),
      },
    });
    return getMeResponse(userId);
  });
}
