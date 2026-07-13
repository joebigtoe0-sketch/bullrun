import { MARKET_FEE } from './constants.js';

export const MARKET_GOLD_QUANTITIES = [250, 500, 1000, 2500] as const;

export function buildGoldListingMessage(args: {
  wallet: string;
  goldQty: number;
  tokenPrice: number;
}): string {
  return [
    'List gold for sale on Bull Race',
    '',
    `Wallet: ${args.wallet}`,
    `Gold: ${args.goldQty}`,
    `Price: ${args.tokenPrice} tokens`,
  ].join('\n');
}

export function buyerPaysTokens(sellerPrice: number): number {
  return Math.round(sellerPrice * (1 + MARKET_FEE) * 1e6) / 1e6;
}

/** Total gold for a material listing (price is per 100 units). */
export function materialListingTotal(pricePer100: number, qty: number): number {
  return Math.max(1, Math.round((pricePer100 * qty) / 100));
}
