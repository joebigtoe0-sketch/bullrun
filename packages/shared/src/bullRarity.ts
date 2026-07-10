import type { BullRarity, BullTrait } from './types.js';

export const BULL_RARITY_ORDER: BullRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export const BULL_RARITY_LABEL: Record<BullRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

export const BULL_RARITY_COLOR: Record<BullRarity, string> = {
  common: '#c9b896',
  uncommon: '#7dc24f',
  rare: '#5fb4d8',
  legendary: '#f2b23a',
};

/** Den / breed drop rates (cumulative thresholds). */
export function rollBullRarity(rand: number): BullRarity {
  if (rand < 0.01) return 'legendary';
  if (rand < 0.04) return 'rare';
  if (rand < 0.24) return 'uncommon';
  return 'common';
}

/** Trait pools per rarity — commons are always plain. */
export const TRAIT_POOLS: Record<BullRarity, BullTrait[]> = {
  common: [],
  uncommon: ['spotted', 'longhorn'],
  rare: ['golden', 'zebra', 'shadow', 'rainbow'],
  legendary: ['ghost', 'skeleton', 'unicorn', 'inferno'],
};

export const BULL_TRAIT_LABEL: Record<BullTrait, string> = {
  normal: 'Plain',
  spotted: 'Spotted',
  longhorn: 'Longhorn',
  golden: 'Golden',
  zebra: 'Zebra',
  shadow: 'Shadow',
  rainbow: 'Rainbow',
  ghost: 'Ghost',
  skeleton: 'Skeleton',
  unicorn: 'Unicorn',
  inferno: 'Inferno',
};

export const BULL_TRAIT_DESC: Record<BullTrait, string> = {
  normal: 'A good honest bull.',
  spotted: 'Painted with dark patches.',
  longhorn: 'Sweeping oversized horns.',
  golden: 'Gilded coat that glints in the sun.',
  zebra: 'Striped like the savanna.',
  shadow: 'Wreathed in gloom, eyes glowing violet.',
  rainbow: 'Coat cycles through every color.',
  ghost: 'Translucent — you can see right through it.',
  skeleton: 'Bare bones and still running.',
  unicorn: 'A pastel legend with a spiral horn — each one its own color.',
  inferno: 'Smolders as it runs, flames licking its back.',
};

/** Chance of rolling any trait at all, per rarity. */
const TRAIT_CHANCE: Record<BullRarity, number> = {
  common: 0,
  uncommon: 0.45,
  rare: 0.75,
  legendary: 1,
};

export function traitForRarity(rarity: BullRarity, rand: number): BullTrait {
  const pool = TRAIT_POOLS[rarity];
  const chance = TRAIT_CHANCE[rarity];
  if (!pool.length || rand >= chance) return 'normal';
  // reuse the roll's fraction inside the trait window to pick from the pool
  const idx = Math.min(pool.length - 1, Math.floor((rand / chance) * pool.length));
  return pool[idx];
}

export function statRangeForRarity(rarity: BullRarity): { min: number; max: number } {
  switch (rarity) {
    case 'legendary': return { min: 68, max: 82 };
    case 'rare': return { min: 62, max: 76 };
    case 'uncommon': return { min: 56, max: 70 };
    default: return { min: 48, max: 62 };
  }
}

const RARITY_TIER: Record<BullRarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

/**
 * Offspring rarity from two parents. Higher-rarity parents shift the whole
 * distribution upward: two commons ≈ base drop rates, two uncommons favor
 * uncommon over common, and rare/legendary odds climb with parent quality.
 */
export function rollBreedRarity(a: BullRarity, b: BullRarity, rand: number): BullRarity {
  const tier = (RARITY_TIER[a] + RARITY_TIER[b]) / 2;
  const weights: [BullRarity, number][] = [
    ['legendary', 1 * (1 + 2.4 * tier)],
    ['rare', 3 * (1 + 1.8 * tier)],
    ['uncommon', 20 * (1 + 1.3 * tier)],
    ['common', 76 / (1 + 1.0 * tier)],
  ];
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let r = rand * total;
  for (const [rarity, w] of weights) {
    if ((r -= w) < 0) return rarity;
  }
  return 'common';
}

export function inferBullRarity(trait?: BullTrait, rarity?: BullRarity): BullRarity {
  if (rarity) return rarity;
  if (!trait || trait === 'normal') return 'common';
  for (const r of ['legendary', 'rare', 'uncommon'] as BullRarity[]) {
    if (TRAIT_POOLS[r].includes(trait)) return r;
  }
  return 'common';
}
