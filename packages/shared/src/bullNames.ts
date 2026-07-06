/** Auto-generated bull names — starters, den spawns, breeding offspring. */
export const BULL_NAMES = [
  // Ranch classics
  'Rowdy', 'Biscuit', 'Comet', 'Waffle', 'Tornado', 'Mocha', 'Zippy', 'Boulder',
  'Rusty', 'Nova', 'Bandit', 'Ember', 'Chief', 'Juniper', 'Rocco', 'Sage',
  'Nitro', 'Poppy', 'Dusty', 'Marble', 'Thunder', 'Stampede', 'Buckshot', 'Wrangler',
  'Sundance', 'Outlaw', 'Maverick', 'Bronco', 'Tumbleweed', 'Cactus', 'Lariat', 'Dustbowl',
  'High Noon', 'Wildfire', 'Ironhide', 'Longhorn', 'Bullseye', 'Haymaker', 'Roughneck', 'Grit',
  // Crypto & degen
  'Degen Duke', 'Degen Chad', 'Degen Bull', 'Degen Ape', 'Degen Moon', 'Degen King',
  'Degen Runner', 'Degen Stampede', 'Ultra Degen', 'Certified Degen', 'Degen Prime',
  'Moon Hooves', 'Moon Runner', 'Moon Stampede', 'To The Moon', 'Moon Boy', 'Full Send',
  'HODL Horns', 'HODL King', 'Diamond Hooves', 'Diamond Bull', 'Paper Hooves', 'Paper Hands',
  'Pump King', 'Pump Chaser', 'Ape Mode', 'Ape Stampede', 'Gigabull', 'Giga Chad',
  'Wen Lambo', 'Lambo Dreams', 'Rug Puller', 'No Rugs', 'Liquidated', 'Rekt Runner',
  'Gas Fee', 'Priority Fee', 'Solana Speed', 'On Chain', 'Mainnet Maxi', 'Alpha Bull',
  'Beta Bull', 'Whale Watch', 'Whale Hooves', 'Bag Holder', 'Green Candles', 'Red Candles',
  'Bull Market', 'Bear Bait', 'Memecoin', 'Meme Lord', 'Meme Stampede', 'Based Bull',
  'WAGMI', 'NGMI', 'Probably Nothing', 'Trust Me Bro', 'Few Understand', 'Early Bull',
  'Late Entry', 'Snipe King', 'Front Run', 'MEV Runner', 'Block Height', 'Finality',
  'Stake King', 'Yield Bull', 'Airdrop Hunter', 'Points Farmer', 'Token Bull', 'Mint Fresh',
  'Pump Fun', 'Chart Bull', 'Candle Runner', 'ATH Chaser', 'Support Level', 'Breakout Bull',
  'FOMO Hooves', 'Copium', 'Hopium', 'Max Extract', 'Exit Liquidity', 'Smart Money',
  'Dumb Money', 'Conviction', 'Send It', 'All In', 'Double Down', 'Leverage Larry',
  'Perp Bull', 'Spot King', 'Cold Wallet', 'Hot Wallet', 'Seed Phrase', 'Not Financial Advice',
  'Satoshi Hooves', 'Halving Bull', 'Block Reward', 'Hash Rate', 'Proof of Bull',
  'Vitalik Vibes', 'CZ Energy', 'Ansem Approved', 'CT Favorite', 'Timeline Bull',
  'KOL Runner', 'Influencer', 'Shill King', 'Narrative', 'Meta Bull', 'Rotation Play',
  'Blue Chip', 'Micro Cap', 'Low Float', 'High FDV', 'Vampire Attack', 'Bridge Bull',
  'Layer Two', 'Rollup Runner', 'ZK Bull', 'DeFi Degenerate', 'Yield Farm', 'Liquidity Bull',
  'Slippage King', 'MEV Victim', 'Sandwich Proof', 'Rug Survivor', 'CTO Bull', 'Community Takeover',
] as const;

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Pick a random bull name. Pass a seed for deterministic picks (spawns, starters). */
export function pickRandomBullName(seed?: number): string {
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;
  return BULL_NAMES[Math.floor(rng() * BULL_NAMES.length)]!;
}

/** @deprecated Use pickRandomBullName */
export function pickStarterBullName(seed = Date.now()): string {
  return pickRandomBullName(seed);
}

/** Legacy export */
export const CALF_NAMES = BULL_NAMES;
