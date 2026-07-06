import { grantResourcesByWallet } from '../src/lib/grantResources.js';

const WALLET = process.argv[2];
if (!WALLET) {
  console.error('Usage: pnpm grant:resources <walletAddress>');
  process.exit(1);
}

const gold = Number(process.env.GRANT_GOLD ?? 2000);
const hay = Number(process.env.GRANT_HAY ?? 10_000);
const ore = Number(process.env.GRANT_ORE ?? 10_000);
const wood = Number(process.env.GRANT_WOOD ?? 10_000);

grantResourcesByWallet(WALLET, { gold, hay, ore, wood })
  .then((result) => {
    console.log(`Granted to ${result.displayName} (${WALLET.slice(0, 6)}…${WALLET.slice(-4)})`);
    console.log({ gold: result.gold, hay: result.hay, ore: result.ore, wood: result.wood });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
