export const RACE_PURSE_TOTAL = 1000;

/** Prize gold by finish position (1-indexed) for a given field size. Last places get 0. */
export function racePrizeForPosition(pos: number, fieldSize: number): number {
  const n = Math.max(1, Math.min(6, fieldSize));
  const shares: Record<number, number[]> = {
    6: [0.42, 0.28, 0.18, 0.12, 0, 0],
    5: [0.45, 0.30, 0.18, 0.07, 0],
    4: [0.50, 0.30, 0.15, 0.05],
    3: [0.55, 0.30, 0.15],
    2: [0.65, 0.35],
    1: [1],
  };
  const table = shares[n] ?? shares[6];
  const idx = pos - 1;
  if (idx < 0 || idx >= table.length) return 0;
  return Math.round(RACE_PURSE_TOTAL * table[idx]);
}
