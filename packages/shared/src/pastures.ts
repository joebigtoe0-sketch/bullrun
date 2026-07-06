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

/** Fence thickness used for collision + interaction (world units). */
export const PASTURE_FENCE_MARGIN = 0.42;

/** How close to the fence ring you can be to buy / open the den menu. */
export const DEN_INTERACT_RANGE = 2.4;

const DEN_W = 3.6;
const DEN_H = 3.5;
const DEN_GAP = 1.5;
const MAP = 52;
const EDGE = 1.0;

const leftCy = (i: number) => EDGE + 2.5 + i * (DEN_H + DEN_GAP);
const bottomCx = (i: number, count: number) => {
  const span = MAP - EDGE * 2 - DEN_W;
  const gap = count > 1 ? (span - count * DEN_W) / (count - 1) : 0;
  return EDGE + i * (DEN_W + gap);
};
const bottomY = MAP - EDGE - DEN_H - PASTURE_FENCE_MARGIN;

/** Dens pinned to the left edge and along the full bottom edge of the map. */
export const PASTURE_PLOTS: PasturePlotDef[] = [
  { id: 0, cx: EDGE, cy: leftCy(0), w: DEN_W, h: DEN_H, price: 120, label: 'Den 1' },
  { id: 1, cx: EDGE, cy: leftCy(1), w: DEN_W, h: DEN_H, price: 140, label: 'Den 2' },
  { id: 2, cx: EDGE, cy: leftCy(2), w: DEN_W, h: DEN_H, price: 160, label: 'Den 3' },
  { id: 3, cx: EDGE, cy: leftCy(3), w: DEN_W, h: DEN_H, price: 180, label: 'Den 4' },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: 4 + i,
    cx: bottomCx(i, 8),
    cy: bottomY,
    w: DEN_W,
    h: DEN_H,
    price: 200 + i * 20,
    label: `Den ${5 + i}`,
  })),
];

export const MAX_FOLLOWING_BULLS = 3;
export const DEN_BASE_CAPACITY = 3;

export function denCapacity(level: number): number {
  return DEN_BASE_CAPACITY + (level - 1) * 2;
}

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

  return {
    name: CALF_NAMES[Math.floor(rng() * CALF_NAMES.length)],
    coat,
    trait,
    speed: 45 + Math.floor(rng() * 35),
    stamina: 45 + Math.floor(rng() * 35),
    accel: 45 + Math.floor(rng() * 35),
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
