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

export function traitForRarity(rarity: BullRarity, rand: number): BullTrait {
  if (rarity === 'legendary') return 'ghost';
  if (rarity === 'rare' && rand < 0.55) return 'rainbow';
  return 'normal';
}

export function statRangeForRarity(rarity: BullRarity): { min: number; max: number } {
  switch (rarity) {
    case 'legendary': return { min: 68, max: 82 };
    case 'rare': return { min: 62, max: 76 };
    case 'uncommon': return { min: 56, max: 70 };
    default: return { min: 48, max: 62 };
  }
}

export function inferBullRarity(trait?: BullTrait, rarity?: BullRarity): BullRarity {
  if (rarity) return rarity;
  if (trait === 'ghost') return 'legendary';
  if (trait === 'rainbow') return 'rare';
  return 'common';
}
