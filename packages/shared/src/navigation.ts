import {
  WORLD_CX,
  WORLD_CY,
  WORLD_RX,
  WORLD_RY,
  WORLD_SIZE,
} from './constants.js';
import { PASTURE_PLOTS, PASTURE_FENCE_MARGIN } from './pastures.js';

const TRACK_INNER = 0.79;
const TRACK_OUTER = 1.225;
const PASTURE_FENCE = PASTURE_FENCE_MARGIN;
const PASTURE_INNER = 0.38;

/** Race track + fence band — blocks walking through the track oval. */
export function isTrackBlocked(x: number, y: number): boolean {
  const ex = (x - WORLD_CX) / WORLD_RX;
  const ey = (y - WORLD_CY) / WORLD_RY;
  const e = Math.hypot(ex, ey);
  return e > TRACK_INNER && e < TRACK_OUTER;
}

/** Pasture fence ring (perimeter blocks, interior walkable). */
export function isPastureFenceBlocked(x: number, y: number): boolean {
  for (const p of PASTURE_PLOTS) {
    const inOuter =
      x >= p.cx - PASTURE_FENCE &&
      x <= p.cx + p.w + PASTURE_FENCE &&
      y >= p.cy - PASTURE_FENCE &&
      y <= p.cy + p.h + PASTURE_FENCE;
    const inInner =
      x >= p.cx + PASTURE_INNER &&
      x <= p.cx + p.w - PASTURE_INNER &&
      y >= p.cy + PASTURE_INNER &&
      y <= p.cy + p.h - PASTURE_INNER;
    if (inOuter && !inInner) return true;
  }
  return false;
}

export function isWorldBlocked(x: number, y: number): boolean {
  return isTrackBlocked(x, y) || isPastureFenceBlocked(x, y);
}

export function isWalkableCell(gx: number, gy: number, M = WORLD_SIZE): boolean {
  if (gx < 1 || gy < 1 || gx >= M - 1 || gy >= M - 1) return false;
  return !isWorldBlocked(gx + 0.5, gy + 0.5);
}

/** Push entity out of track fence band (legacy behaviour). */
export function trackClamp(
  o: { x: number; y: number },
  CX = WORLD_CX,
  CY = WORLD_CY,
  RX = WORLD_RX,
  RY = WORLD_RY,
): boolean {
  const ex = (o.x - CX) / RX;
  const ey = (o.y - CY) / RY;
  const e = Math.hypot(ex, ey);
  if (e > TRACK_INNER && e < TRACK_OUTER && e > 0.01) {
    const to = e < 1.0 ? TRACK_INNER : TRACK_OUTER;
    o.x = CX + (ex / e) * to * RX;
    o.y = CY + (ey / e) * to * RY;
    return true;
  }
  return false;
}

function pushOutOfPastureFence(o: { x: number; y: number }): boolean {
  for (const p of PASTURE_PLOTS) {
    const inOuter =
      o.x >= p.cx - PASTURE_FENCE &&
      o.x <= p.cx + p.w + PASTURE_FENCE &&
      o.y >= p.cy - PASTURE_FENCE &&
      o.y <= p.cy + p.h + PASTURE_FENCE;
    const inInner =
      o.x >= p.cx + PASTURE_INNER &&
      o.x <= p.cx + p.w - PASTURE_INNER &&
      o.y >= p.cy + PASTURE_INNER &&
      o.y <= p.cy + p.h - PASTURE_INNER;
    if (!inOuter || inInner) continue;

    const dl = o.x - (p.cx - PASTURE_FENCE);
    const dr = p.cx + p.w + PASTURE_FENCE - o.x;
    const dt = o.y - (p.cy - PASTURE_FENCE);
    const db = p.cy + p.h + PASTURE_FENCE - o.y;
    const min = Math.min(dl, dr, dt, db);
    if (min === dl) o.x = p.cx - PASTURE_FENCE - 0.05;
    else if (min === dr) o.x = p.cx + p.w + PASTURE_FENCE + 0.05;
    else if (min === dt) o.y = p.cy - PASTURE_FENCE - 0.05;
    else o.y = p.cy + p.h + PASTURE_FENCE + 0.05;
    return true;
  }
  return false;
}

/** Resolve collisions with track fences and pasture fences. */
export function applyWorldCollision(o: { x: number; y: number }): boolean {
  const a = trackClamp(o);
  const b = pushOutOfPastureFence(o);
  return a || b;
}

type Cell = { x: number; y: number };

function cellKey(c: Cell) {
  return `${c.x},${c.y}`;
}

function nearestWalkable(gx: number, gy: number, M: number): Cell | null {
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  if (isWalkableCell(ix, iy, M)) return { x: ix, y: iy };
  for (let r = 1; r < 24; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = ix + dx;
        const y = iy + dy;
        if (isWalkableCell(x, y, M)) return { x, y };
      }
    }
  }
  return null;
}

const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Grid A* path in world space; returns waypoint centers. */
export function findPath(
  sx: number,
  sy: number,
  gx: number,
  gy: number,
  M = WORLD_SIZE,
): { x: number; y: number }[] {
  const start = nearestWalkable(sx, sy, M);
  const goal = nearestWalkable(gx, gy, M);
  if (!start || !goal) return [];
  if (start.x === goal.x && start.y === goal.y) {
    return [{ x: goal.x + 0.5, y: goal.y + 0.5 }];
  }

  const open = new Map<string, { f: number; cell: Cell }>();
  const cameFrom = new Map<string, Cell>();
  const gScore = new Map<string, number>();

  const h = (c: Cell) => Math.hypot(c.x - goal.x, c.y - goal.y);
  const sk = cellKey(start);
  gScore.set(sk, 0);
  open.set(sk, { f: h(start), cell: start });

  let iterations = 0;
  while (open.size > 0 && iterations++ < 4000) {
    let currentKey = '';
    let bestF = Infinity;
    for (const [k, v] of open) {
      if (v.f < bestF) {
        bestF = v.f;
        currentKey = k;
      }
    }
    const current = open.get(currentKey)!.cell;
    open.delete(currentKey);

    if (current.x === goal.x && current.y === goal.y) {
      const path: Cell[] = [current];
      let ck = currentKey;
      while (cameFrom.has(ck)) {
        const prev = cameFrom.get(ck)!;
        path.unshift(prev);
        ck = cellKey(prev);
      }
      return path.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }));
    }

    for (const [dx, dy] of NEIGHBORS) {
      const nb = { x: current.x + dx, y: current.y + dy };
      if (!isWalkableCell(nb.x, nb.y, M)) continue;
      const nk = cellKey(nb);
      const step = dx !== 0 && dy !== 0 ? 1.414 : 1;
      const tg = (gScore.get(currentKey) ?? Infinity) + step;
      if (tg >= (gScore.get(nk) ?? Infinity)) continue;
      cameFrom.set(nk, current);
      gScore.set(nk, tg);
      open.set(nk, { f: tg + h(nb), cell: nb });
    }
  }

  return [];
}
