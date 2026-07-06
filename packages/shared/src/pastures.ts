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

/** Fenced pasture plots along the left edge and bottom-left of the map. */
export const PASTURE_PLOTS: PasturePlotDef[] = [
  // Left column (4 plots)
  { id: 0, cx: 2.4, cy: 12.0, w: 3.6, h: 4.0, price: 120, label: 'Plot 1' },
  { id: 1, cx: 2.4, cy: 17.0, w: 3.6, h: 4.0, price: 140, label: 'Plot 2' },
  { id: 2, cx: 2.4, cy: 22.0, w: 3.6, h: 4.0, price: 160, label: 'Plot 3' },
  { id: 3, cx: 2.4, cy: 27.0, w: 3.6, h: 4.0, price: 180, label: 'Plot 4' },
  // Bottom row (4 plots)
  { id: 4, cx: 6.0, cy: 40.5, w: 4.2, h: 3.5, price: 200, label: 'Plot 5' },
  { id: 5, cx: 11.0, cy: 40.5, w: 4.2, h: 3.5, price: 220, label: 'Plot 6' },
  { id: 6, cx: 16.0, cy: 40.5, w: 4.2, h: 3.5, price: 240, label: 'Plot 7' },
  { id: 7, cx: 21.0, cy: 40.5, w: 4.2, h: 3.5, price: 260, label: 'Plot 8' },
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

const CALF_NAMES = ['Rowdy', 'Biscuit', 'Comet', 'Waffle', 'Tornado', 'Mocha', 'Zippy', 'Boulder', 'Rusty', 'Nova', 'Bandit', 'Ember', 'Chief', 'Juniper', 'Rocco', 'Sage', 'Nitro', 'Poppy', 'Dusty', 'Marble'];
const COATS = ['#8e2f2f', '#e8e4da', '#14141a', '#3b6ea5', '#c99a5b', '#7a5296', '#1d1a17', '#6e4526'];

export function pickStarterBullName(seed = Date.now()): string {
  let s = seed;
  const rng = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return CALF_NAMES[Math.floor(rng() * CALF_NAMES.length)];
}

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
