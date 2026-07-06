import type { BullTrait, BullRarity, MatType } from './types.js';
import { inferBullRarity } from './bullRarity.js';

/** Legacy DB stats below this are multiplied on read. */
export const STAT_LEGACY_THRESHOLD = 50;
export const STAT_LEGACY_MULT = 10;
export const TRAIN_STAT_GAIN = 3;

export function normalizeStat(v: number): number {
  return v < STAT_LEGACY_THRESHOLD ? v * STAT_LEGACY_MULT : v;
}

export function maxBullLevel(rarityOrTrait?: BullRarity | BullTrait): number {
  const r = typeof rarityOrTrait === 'string'
    ? (['common', 'uncommon', 'rare', 'legendary'].includes(rarityOrTrait)
      ? rarityOrTrait as BullRarity
      : inferBullRarity(rarityOrTrait as BullTrait))
    : 'common';
  if (r === 'legendary') return 35;
  if (r === 'rare') return 28;
  if (r === 'uncommon') return 25;
  return 22;
}

export function statCap(bull: { level: number; trait?: BullTrait; rarity?: BullRarity }): number {
  const rarity = inferBullRarity(bull.trait, bull.rarity);
  const base = rarity === 'legendary' ? 780 : rarity === 'rare' ? 720 : rarity === 'uncommon' ? 680 : 640;
  return base + bull.level * 15;
}

/** Hay cost to train one stat — scales with bull level. */
export function trainHayCost(level: number): number {
  return 50 + level * 25;
}

export function matNodeType(mat: MatType): 'tree' | 'rock' | 'hay' {
  if (mat === 'wood') return 'tree';
  if (mat === 'ore') return 'rock';
  return 'hay';
}
