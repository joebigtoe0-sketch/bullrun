import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from '../db.js';
import { getTokenBalance, isTokenGateConfigured } from '../lib/solana.js';

function isValidSolanaAddress(addr: string): boolean {
  try {
    return bs58.decode(addr).length === 32;
  } catch {
    return false;
  }
}

function buildLinkMessage(wallet: string, nonce: string): string {
  return `Sign in to Bull Race\n\nWallet: ${wallet}\nNonce: ${nonce}`;
}

export async function walletAuthRoutes(app: FastifyInstance) {
  // Link a Solana wallet to the logged-in account (auth handled by the global preHandler).
  app.post<{ Body: { walletAddress: string } }>('/auth/link-nonce', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const { walletAddress } = req.body;
    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      return reply.status(400).send({ error: 'Invalid wallet address' });
    }
    const taken = await prisma.user.findUnique({ where: { walletAddress } });
    if (taken && taken.id !== userId) {
      return reply.status(409).send({ error: 'Wallet already linked to another account' });
    }
    const nonce = crypto.randomBytes(16).toString('hex');
    await prisma.user.update({ where: { id: userId }, data: { authNonce: nonce } });
    return { message: buildLinkMessage(walletAddress, nonce) };
  });

  app.post<{ Body: { walletAddress: string; signature: string } }>('/auth/link-verify', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature || !isValidSolanaAddress(walletAddress)) {
      return reply.status(400).send({ error: 'Invalid request' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.authNonce) {
      return reply.status(400).send({ error: 'Request a link message first' });
    }
    const taken = await prisma.user.findUnique({ where: { walletAddress } });
    if (taken && taken.id !== userId) {
      return reply.status(409).send({ error: 'Wallet already linked to another account' });
    }

    const message = buildLinkMessage(walletAddress, user.authNonce);
    let valid = false;
    try {
      valid = nacl.sign.detached.verify(
        new TextEncoder().encode(message),
        bs58.decode(signature),
        bs58.decode(walletAddress),
      );
    } catch {
      valid = false;
    }
    if (!valid) {
      return reply.status(401).send({ error: 'Signature verification failed' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { walletAddress, authNonce: null },
    });
    return { walletAddress };
  });

  // No token gate — everyone can play. Kept for the token balance shown in the profile.
  app.get('/auth/access', async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.walletAddress || !isTokenGateConfigured()) {
      return { balance: 0, required: 0, hasAccess: true, configured: isTokenGateConfigured() };
    }
    const balance = await getTokenBalance(user.walletAddress);
    return { balance, required: 0, hasAccess: true, configured: true };
  });
}
