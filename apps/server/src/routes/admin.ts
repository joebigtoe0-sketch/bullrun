import type { FastifyInstance } from 'fastify';
import { grantResourcesByWallet } from '../lib/grantResources.js';

export async function adminRoutes(app: FastifyInstance) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return;

  app.post<{
    Body: {
      walletAddress: string;
      gold?: number;
      hay?: number;
      ore?: number;
      wood?: number;
    };
  }>('/admin/grant', async (req, reply) => {
    if (req.headers['x-admin-secret'] !== secret) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { walletAddress, gold, hay, ore, wood } = req.body;
    if (!walletAddress) {
      return reply.status(400).send({ error: 'walletAddress required' });
    }

    try {
      const updated = await grantResourcesByWallet(walletAddress, {
        gold,
        hay,
        ore,
        wood,
      });

      return {
        ok: true,
        displayName: updated.displayName,
        walletAddress,
        gold: updated.gold,
        hay: updated.hay,
        ore: updated.ore,
        wood: updated.wood,
      };
    } catch (err) {
      return reply.status(404).send({ error: (err as Error).message });
    }
  });
}
