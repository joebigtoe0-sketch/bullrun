import { prisma } from '../db.js';

export async function grantResourcesByWallet(
  walletAddress: string,
  amounts: { gold?: number; hay?: number; ore?: number; wood?: number },
) {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
    include: { profile: true },
  });
  if (!user?.profile) {
    throw new Error(`No player found for wallet ${walletAddress}`);
  }

  const data: { gold?: number; hay?: number; ore?: number; wood?: number } = {};
  if (amounts.gold !== undefined) data.gold = amounts.gold;
  if (amounts.hay !== undefined) data.hay = amounts.hay;
  if (amounts.ore !== undefined) data.ore = amounts.ore;
  if (amounts.wood !== undefined) data.wood = amounts.wood;

  const updated = await prisma.playerProfile.update({
    where: { userId: user.id },
    data,
  });

  return { displayName: user.displayName, walletAddress, ...updated };
}

export async function grantFromEnvIfSet() {
  const wallet = process.env.GRANT_WALLET?.trim();
  if (!wallet) return;

  const result = await grantResourcesByWallet(wallet, {
    gold: Number(process.env.GRANT_GOLD ?? 2000),
    hay: Number(process.env.GRANT_HAY ?? 10_000),
    ore: Number(process.env.GRANT_ORE ?? 10_000),
    wood: Number(process.env.GRANT_WOOD ?? 10_000),
  });

  console.log('[grant] Applied startup grant:', {
    displayName: result.displayName,
    wallet: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
    gold: result.gold,
    hay: result.hay,
    ore: result.ore,
    wood: result.wood,
  });
}
