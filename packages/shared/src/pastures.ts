import type { BullTrait } from './types.js';

export interface PasturePlotDef {
  id: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  price: number;
  label: string;
}

/** Fenced pasture plots on the west side of the map. */
export const PASTURE_PLOTS: PasturePlotDef[] = [
  { id: 0, cx: 2.8, cy: 10.5, w: 3.8, h: 4.2, price: 120, label: 'Plot 1' },
  { id: 1, cx: 2.8, cy: 16.2, w: 3.8, h: 4.2, price: 150, label: 'Plot 2' },
  { id: 2, cx: 2.8, cy: 21.9, w: 3.8, h: 4.2, price: 180, label: 'Plot 3' },
  { id: 3, cx: 8.2, cy: 10.5, w: 3.8, h: 4.2, price: 200, label: 'Plot 4' },
  { id: 4, cx: 8.2, cy: 16.2, w: 3.8, h: 4.2, price: 220, label: 'Plot 5' },
  { id: 5, cx: 8.2, cy: 21.9, w: 3.8, h: 4.2, price: 250, label: 'Plot 6' },
];

/** Base spawn interval per owned plot (testing: ~20s at level 1). */
export const PASTURE_BASE_SPAWN_MS = 20_000;
export const PASTURE_WOOD_UPGRADE_COST = 10;
export const PASTURE_WOOD_PER_LEVEL = 15;

export function pastureSpawnIntervalMs(level: number): number {
  return Math.max(8_000, Math.floor(PASTURE_BASE_SPAWN_MS / Math.max(1, level)));
}

export function pastureWoodToNextLevel(level: number, woodInvested: number): number {
  return Math.max(0, PASTURE_WOOD_PER_LEVEL * level - woodInvested);
}

const CALF_NAMES = ['Rowdy', 'Biscuit', 'Comet', 'Waffle', 'Tornado', 'Mocha', 'Zippy', 'Boulder', 'Rusty', 'Nova'];
const COATS = ['#8e2f2f', '#e8e4da', '#14141a', '#3b6ea5', '#c99a5b', '#7a5296', '#1d1a17', '#6e4526'];

export function rollPastureBull(seed: number): {
  name: string;
  coat: string;
  trait: BullTrait;
  speed: number;
  stamina: number;
  accel: number;
  temper: number;
} {
  let s = seed;
  const rng = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const r = rng();
  let trait: BullTrait = 'normal';
  let coat = COATS[Math.floor(rng() * COATS.length)];
  if (r < 0.03) trait = 'ghost';
  else if (r < 0.13) trait = 'rainbow';
  else if (r < 0.35) coat = COATS[Math.floor(rng() * COATS.length)];

  return {
    name: CALF_NAMES[Math.floor(rng() * CALF_NAMES.length)],
    coat,
    trait,
    speed: 4 + Math.floor(rng() * 5),
    stamina: 4 + Math.floor(rng() * 5),
    accel: 4 + Math.floor(rng() * 5),
    temper: 1 + Math.floor(rng() * 7),
  };
}

export function pastureCenter(plot: PasturePlotDef) {
  return { x: plot.cx + plot.w / 2, y: plot.cy + plot.h / 2 };
}
