import type { AnsemState, AnsemAdminView } from '@bullrace/shared';
import { prisma } from '../db.js';
import { getMeResponse } from './player.js';
import { requireNearInteractable } from './proximity.js';

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || 'dev')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminUsername(username: string | undefined | null): boolean {
  return !!username && ADMIN_USERNAMES.includes(username.toLowerCase());
}

export async function requireAdmin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (!isAdminUsername(user?.username)) throw new Error('Admins only');
}

async function openCycle() {
  return prisma.ansemCycle.findFirst({ where: { status: 'open' }, orderBy: { createdAt: 'desc' } });
}

/* ---------------- player-facing ---------------- */

export async function getAnsemState(userId: string): Promise<AnsemState> {
  const cycle = await openCycle();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletAddress: true } });
  const hasWallet = !!user?.walletAddress;
  if (!cycle) {
    return { open: false, targetGold: 0, tokenUsd: 0, collectedGold: 0, myGold: 0, hasWallet };
  }
  const mine = await prisma.ansemDeposit.findUnique({
    where: { cycleId_userId: { cycleId: cycle.id, userId } },
  });
  return {
    open: true,
    targetGold: cycle.targetGold,
    tokenUsd: cycle.tokenUsd,
    collectedGold: cycle.collectedGold,
    myGold: mine?.gold ?? 0,
    hasWallet,
  };
}

export async function depositToAnsem(userId: string, amount: number) {
  await requireNearInteractable(userId, 'ansem');
  const amt = Math.floor(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter an amount');

  const cycle = await openCycle();
  if (!cycle) throw new Error("Ansem isn't trading right now");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletAddress: true } });
  if (!user?.walletAddress) throw new Error('Connect your wallet in Profile so Ansem can airdrop your $ANSEM');

  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');
  if (profile.gold < amt) throw new Error('Not enough gold');

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { userId }, data: { gold: profile.gold - amt } }),
    prisma.ansemCycle.update({ where: { id: cycle.id }, data: { collectedGold: cycle.collectedGold + amt } }),
    prisma.ansemDeposit.upsert({
      where: { cycleId_userId: { cycleId: cycle.id, userId } },
      create: { cycleId: cycle.id, userId, gold: amt },
      update: { gold: { increment: amt } },
    }),
  ]);

  return getMeResponse(userId);
}

/* ---------------- admin ---------------- */

export async function getAnsemAdminView(): Promise<AnsemAdminView> {
  const cycle = await openCycle();
  if (!cycle) return { cycle: null, depositors: [] };
  const deps = await prisma.ansemDeposit.findMany({
    where: { cycleId: cycle.id },
    include: { user: { select: { displayName: true, username: true, walletAddress: true } } },
    orderBy: { gold: 'desc' },
  });
  const total = deps.reduce((s, d) => s + d.gold, 0) || 1;
  return {
    cycle: {
      id: cycle.id,
      status: cycle.status,
      targetGold: cycle.targetGold,
      tokenUsd: cycle.tokenUsd,
      collectedGold: cycle.collectedGold,
      createdAt: cycle.createdAt.getTime(),
    },
    depositors: deps.map((d) => ({
      userId: d.userId,
      displayName: d.user.displayName,
      username: d.user.username,
      walletAddress: d.user.walletAddress,
      gold: d.gold,
      pct: (d.gold / total) * 100,
    })),
  };
}

export async function openAnsemCycle(targetGold: number, tokenUsd: number): Promise<AnsemAdminView> {
  const target = Math.floor(targetGold);
  const usd = Number(tokenUsd);
  if (!Number.isFinite(target) || target <= 0) throw new Error('Set a gold target above 0');
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('Set the $ANSEM value above 0');
  // close any currently-open cycle first
  await prisma.ansemCycle.updateMany({ where: { status: 'open' }, data: { status: 'closed', closedAt: new Date() } });
  await prisma.ansemCycle.create({ data: { targetGold: target, tokenUsd: usd, status: 'open' } });
  return getAnsemAdminView();
}

export async function closeAnsemCycle(): Promise<AnsemAdminView> {
  await prisma.ansemCycle.updateMany({ where: { status: 'open' }, data: { status: 'closed', closedAt: new Date() } });
  return getAnsemAdminView();
}
