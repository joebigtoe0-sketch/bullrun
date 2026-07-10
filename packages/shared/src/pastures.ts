import type { BullTrait, BullRarity } from './types.js';
import {
  rollBullRarity,
  traitForRarity,
  statRangeForRarity,
} from './bullRarity.js';
import { BULL_NAMES } from './bullNames.js';

export interface PasturePlotDef {
  id: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  price: number;
  label: string;
}

/** Fence thickness used for collision + interaction (world units). */
export const PASTURE_FENCE_MARGIN = 0.42;

/** How close to the fence ring you can be to buy / open the den menu. */
export const DEN_INTERACT_RANGE = 2.4;
export const DEN_PRICE = 1000;
export const MAX_DENS_PER_PLAYER = 1;

const DEN_W = 3.6;
const DEN_H = 3.5;
const DEN_GAP = 1.2;
const MAP = 56;
const EDGE = 1.0;

/** Keep top/bottom rows clear of left/right columns at map corners. */
const CORNER_INSET = EDGE + DEN_W + PASTURE_FENCE_MARGIN + DEN_GAP;
const TOP_ROW_RIGHT = MAP - EDGE - DEN_W - PASTURE_FENCE_MARGIN - DEN_GAP;
const SIDE_START_Y = EDGE + DEN_H + DEN_GAP + PASTURE_FENCE_MARGIN;

const edgeCx = (i: number, count: number) => {
  const span = TOP_ROW_RIGHT - CORNER_INSET;
  const gap = count > 1 ? (span - count * DEN_W) / (count - 1) : 0;
  return CORNER_INSET + i * (DEN_W + gap);
};
const leftCy = (i: number) => SIDE_START_Y + i * (DEN_H + DEN_GAP);
const bottomY = MAP - EDGE - DEN_H - PASTURE_FENCE_MARGIN;
const topY = EDGE;
const rightCx = MAP - EDGE - DEN_W - PASTURE_FENCE_MARGIN;
const rightCy = leftCy;

function den(id: number, cx: number, cy: number, label: string, price: number): PasturePlotDef {
  return { id, cx, cy, w: DEN_W, h: DEN_H, price, label };
}

/** Dens along left, bottom, top, and right map edges. */
export const PASTURE_PLOTS: PasturePlotDef[] = [
  ...Array.from({ length: 6 }, (_, i) => den(i, EDGE, leftCy(i), `Den ${i + 1}`, DEN_PRICE)),
  ...Array.from({ length: 8 }, (_, i) => den(6 + i, edgeCx(i, 8), bottomY, `Den ${7 + i}`, DEN_PRICE)),
  ...Array.from({ length: 6 }, (_, i) => den(14 + i, edgeCx(i, 6), topY, `Den ${15 + i}`, DEN_PRICE)),
  ...Array.from({ length: 6 }, (_, i) => den(20 + i, rightCx, rightCy(i), `Den ${21 + i}`, DEN_PRICE)),
];

export const MAX_FOLLOWING_BULLS = 3;
export const DEN_BASE_CAPACITY = 3;

export function denCapacity(level: number): number {
  return DEN_BASE_CAPACITY + (level - 1) * 2;
}

/** Bulls spawn every 60 minutes per den. */
export const PASTURE_SPAWN_MS = 60 * 60 * 1000;
export const PASTURE_WOOD_UPGRADE_COST = 35;
export const PASTURE_WOOD_PER_LEVEL = 40;

export function pastureSpawnIntervalMs(_level = 1): number {
  return PASTURE_SPAWN_MS;
}

export function pastureWoodToNextLevel(level: number, woodInvested: number): number {
  return Math.max(0, PASTURE_WOOD_PER_LEVEL * level - woodInvested);
}

export function pastureUpgradeGoldCost(level: number): number {
  // 1000 for the first upgrade, 2000 for the second, and so on.
  return 1000 * level;
}

const COATS = ['#8e2f2f', '#e8e4da', '#14141a', '#3b6ea5', '#c99a5b', '#7a5296', '#1d1a17', '#6e4526'];

export function rollPastureBull(seed: number): {
  name: string;
  coat: string;
  trait: BullTrait;
  rarity: BullRarity;
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
  const rarity = rollBullRarity(rng());
  const trait = traitForRarity(rarity, rng());
  const range = statRangeForRarity(rarity);
  const rollStat = () => range.min + Math.floor(rng() * (range.max - range.min + 1));

  return {
    name: BULL_NAMES[Math.floor(rng() * BULL_NAMES.length)]!,
    coat: COATS[Math.floor(rng() * COATS.length)],
    trait,
    rarity,
    speed: rollStat(),
    stamina: rollStat(),
    accel: rollStat(),
    temper: 1 + Math.floor(rng() * 7),
  };
}

export function pastureCenter(plot: PasturePlotDef) {
  return { x: plot.cx + plot.w / 2, y: plot.cy + plot.h / 2 };
}

/** Distance from a point to the outer fence ring of a plot. */
export function distanceToPastureFence(px: number, py: number, plot: PasturePlotDef): number {
  const m = PASTURE_FENCE_MARGIN;
  const x0 = plot.cx - m;
  const x1 = plot.cx + plot.w + m;
  const y0 = plot.cy - m;
  const y1 = plot.cy + plot.h + m;
  const dx = Math.max(x0 - px, 0, px - x1);
  const dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

export function isPointOnPasture(px: number, py: number, plot: PasturePlotDef, extra = 0): boolean {
  const m = PASTURE_FENCE_MARGIN + extra;
  return (
    px >= plot.cx - m &&
    px <= plot.cx + plot.w + m &&
    py >= plot.cy - m &&
    py <= plot.cy + plot.h + m
  );
}

export function isOnAnyPasture(px: number, py: number, extra = 0.35): boolean {
  return PASTURE_PLOTS.some((p) => isPointOnPasture(px, py, p, extra));
}

export function isNearPasturePlot(
  px: number,
  py: number,
  plotId: number,
  range = DEN_INTERACT_RANGE,
): boolean {
  const def = PASTURE_PLOTS.find((p) => p.id === plotId);
  if (!def) return false;
  return distanceToPastureFence(px, py, def) <= range;
}

/** Walk target just outside the nearest fence edge (pathfinding can't reach plot center). */
export function pastureApproachPoint(
  px: number,
  py: number,
  plot: PasturePlotDef,
  standOff = 0.75,
): { x: number; y: number } {
  const m = PASTURE_FENCE_MARGIN;
  const x0 = plot.cx - m;
  const x1 = plot.cx + plot.w + m;
  const y0 = plot.cy - m;
  const y1 = plot.cy + plot.h + m;
  const cx = Math.max(x0, Math.min(px, x1));
  const cy = Math.max(y0, Math.min(py, y1));

  if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
    const dl = px - x0;
    const dr = x1 - px;
    const dt = py - y0;
    const db = y1 - py;
    const min = Math.min(dl, dr, dt, db);
    if (min === dl) return { x: x0 - standOff, y: cy };
    if (min === dr) return { x: x1 + standOff, y: cy };
    if (min === dt) return { x: cx, y: y0 - standOff };
    return { x: cx, y: y1 + standOff };
  }

  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy) || 1;
  return { x: cx + (dx / d) * standOff, y: cy + (dy / d) * standOff };
}

export function nearestPasturePlot(px: number, py: number, maxDist = DEN_INTERACT_RANGE + 1.5): PasturePlotDef | null {
  let best: PasturePlotDef | null = null;
  let bd = maxDist;
  for (const p of PASTURE_PLOTS) {
    const d = distanceToPastureFence(px, py, p);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}
