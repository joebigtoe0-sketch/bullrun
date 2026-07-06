import type { BullTrait, MatType } from './types.js';

/** Legacy DB stats below this are multiplied on read. */
export const STAT_LEGACY_THRESHOLD = 50;
export const STAT_LEGACY_MULT = 10;
export const TRAIN_STAT_GAIN = 3;

export function normalizeStat(v: number): number {
  return v < STAT_LEGACY_THRESHOLD ? v * STAT_LEGACY_MULT : v;
}

export function maxBullLevel(trait?: BullTrait): number {
  if (trait === 'ghost') return 35;
  if (trait === 'rainbow') return 28;
  return 22;
}

export function statCap(bull: { level: number; trait?: BullTrait }): number {
  const trait = bull.trait ?? 'normal';
  const base = trait === 'ghost' ? 200 : trait === 'rainbow' ? 170 : 140;
  return base + bull.level * 6;
}

export function matNodeType(mat: MatType): 'tree' | 'rock' | 'hay' {
  if (mat === 'wood') return 'tree';
  if (mat === 'ore') return 'rock';
  return 'hay';
}
