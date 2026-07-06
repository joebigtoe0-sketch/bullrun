import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from '../db.js';
import { createStarterUser } from '../services/player.js';
import { getTokenBalance, isTokenGateConfigured, MIN_PLAY_TOKENS, walletHasAccess } from '../lib/solana.js';

function isValidSolanaAddress(addr: string): boolean {
  try {
    return bs58.decode(addr).length === 32;
  } catch {
    return false;
  }
}

function buildSignInMessage(wallet: string, nonce: string): string {
  return `Sign in to Bull Run\n\nWallet: ${wallet}\nNonce: ${nonce}`;
}

async function generateHandle(wallet: string): Promise<string> {
  const base = `bull_${wallet.slice(0, 4)}${wallet.slice(-4)}`.toLowerCase();
  let candidate = base;
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.user.findUnique({ where: { username: candidate } });
    if (!exists) return candidate;
    candidate = `${base}_${crypto.randomBytes(2).toString('hex')}`;
  }
  return `${base}_${crypto.randomBytes(4).toString('hex')}`;
}

function autoDisplayName(wallet: string): string {
  return `Rancher_${wallet.slice(0, 4)}`;
}

export async function walletAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: { walletAddress: string } }>('/auth/nonce', async (req, reply) => {
    const { walletAddress } = req.body;
    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      return reply.status(400).send({ error: 'Invalid wallet address' });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      const username = await generateHandle(walletAddress);
      user = await prisma.user.create({
        data: {
          username,
          walletAddress,
          displayName: autoDisplayName(walletAddress),
          hasDisplayName: false,
          authNonce: nonce,
        },
      });
      await createStarterUser(user.id);
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { authNonce: nonce } });
    }

    return { message: buildSignInMessage(walletAddress, nonce) };
  });

  app.post<{ Body: { walletAddress: string; signature: string } }>('/auth/verify', async (req, reply) => {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature || !isValidSolanaAddress(walletAddress)) {
      return reply.status(400).send({ error: 'Invalid request' });
    }

    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user?.authNonce) {
      return reply.status(401).send({ error: 'Request a nonce first' });
    }

    const message = buildSignInMessage(walletAddress, user.authNonce);
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

    await prisma.user.update({ where: { id: user.id }, data: { authNonce: null } });
    const token = app.jwt.sign({ sub: user.id });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        walletAddress: user.walletAddress,
        hasDisplayName: user.hasDisplayName,
      },
    };
  });

  app.post<{ Body: { displayName: string } }>('/auth/display-name', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const displayName = req.body.displayName?.trim();
    if (!displayName || displayName.length < 2 || displayName.length > 24) {
      return reply.status(400).send({ error: 'Display name must be 2–24 characters' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { displayName, hasDisplayName: true },
    });

    const token = app.jwt.sign({ sub: user.id });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        walletAddress: user.walletAddress,
        hasDisplayName: user.hasDisplayName,
      },
    };
  });

  app.get('/auth/access', async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.walletAddress) {
      return { balance: 0, required: MIN_PLAY_TOKENS, hasAccess: false, configured: isTokenGateConfigured() };
    }
    if (!isTokenGateConfigured()) {
      return { balance: 0, required: MIN_PLAY_TOKENS, hasAccess: true, configured: false };
    }
    const balance = await getTokenBalance(user.walletAddress);
    return {
      balance,
      required: MIN_PLAY_TOKENS,
      hasAccess: balance >= MIN_PLAY_TOKENS,
      configured: true,
    };
  });
}

export { walletHasAccess };
