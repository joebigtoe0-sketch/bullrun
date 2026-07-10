import {
  WORLD_CX,
  WORLD_CY,
  WORLD_RX,
  WORLD_RY,
  WORLD_SEED,
  WORLD_SIZE,
  NPC_SHIRT_COLORS,
  FENCE_RINGS,
} from '../constants.js';
import { PASTURE_PLOTS, isOnAnyPasture } from '../pastures.js';
import type { Interactable, NpcWanderer, TileType, WorldData, WorldNode, WorldObject } from '../types.js';

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function buildWorld(npcWanderers = 0): WorldData {
  const M = WORLD_SIZE;
  const CX = WORLD_CX;
  const CY = WORLD_CY;
  const RX = WORLD_RX;
  const RY = WORLD_RY;
  const rng = makeRng(WORLD_SEED);
  const ell = (x: number, y: number) => Math.hypot((x - CX) / RX, (y - CY) / RY);

  const tiles: TileType[][] = [];
  for (let x = 0; x < M; x++) {
    tiles[x] = [];
    for (let y = 0; y < M; y++) {
      const e = ell(x + 0.5, y + 0.5);
      let t: TileType = rng() < 0.5 ? 'g1' : 'g2';
      if (e >= 0.82 && e <= 1.18) t = (Math.floor(x + y) % 2 === 0) ? 'trk1' : 'trk2';
      tiles[x][y] = t;
    }
  }

  const path = (x: number, y: number) => {
    if (tiles[x]?.[y]?.startsWith('g')) tiles[x][y] = 'dirt';
  };
  for (let x = 3; x < 53; x++) { path(x, 40); path(x, 6); }
  for (let y = 6; y < 41; y++) { path(6, y); path(49, y); }
  for (let x = 6; x <= 39; x++) path(x, 37);
  // stable spur down to the main road
  for (let y = 38; y <= 40; y++) path(38, y);
  // bridge approaches: outside (down to the y=37 road) and inside (up into the hub)
  for (let y = 33; y <= 37; y++) path(21, y);
  for (let y = 22; y <= 30; y++) path(21, y);

  const objs: WorldObject[] = [];
  const nodes: WorldNode[] = [];

  // fences around the track: rails between posts (the walkover bridge arches over them)
  const fence = (er: number, n: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: CX + Math.cos(a) * RX * er, y: CY + Math.sin(a) * RY * er });
    }
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      objs.push({ t: 'rail', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
    }
    for (const p of pts) objs.push({ t: 'post', x: p.x, y: p.y });
  };
  for (const { er, n } of FENCE_RINGS) fence(er, n);

  // central hub inside the track — buildings lined along the west road
  objs.push({ t: 'racebooth', x: 19.8, y: 21.2, label: 'RACE SIGNUP' });
  objs.push({ t: 'wheel', x: 19.6, y: 23.8, label: 'DAILY WHEEL' });
  objs.push({ t: 'booth', x: 19.7, y: 25.5, label: 'BETS' });

  objs.push({ t: 'forge', x: 9, y: 32, label: 'FORGE' });
  objs.push({ t: 'market', x: 9, y: 35.5, label: 'MARKET' });
  objs.push({ t: 'stable', x: 38, y: 37.5, label: 'YOUR STABLE' });

  // general store — the old top-right homestead, now sells character clothing
  objs.push({ t: 'store', x: 45, y: 9.5, label: 'GENERAL STORE' });

  // walkover footbridge arching across the track — the way in and out of the hub
  objs.push({ t: 'bridge', x: 21.5, y: 31.3, dir: 'y', len: 8, dSort: 4.5 });

  const occupied = (x: number, y: number, r: number) =>
    objs.some((o) => Math.hypot(o.x - x, o.y - y) < r);

  const free = (x: number, y: number) => {
    if (ell(x, y) < 1.32) return false;
    if (isOnAnyPasture(x, y, 0.4)) return false;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 2 || ty < 2 || tx > M - 3 || ty > M - 3) return false;
    if (tiles[tx][ty] === 'dirt') return false;
    return !occupied(x, y, 2.4);
  };

  const spawnNodes = (
    mat: 'wood' | 'ore' | 'hay',
    t: 'tree' | 'rock' | 'hay',
    count: number,
    topRightBias = 0,
    bigChance = 0,
  ) => {
    let placed = 0;
    let tries = 0;
    while (placed < count && tries++ < 2200) {
      let x: number;
      let y: number;
      if (topRightBias > 0 && rng() < topRightBias) {
        x = 27 + rng() * (M - 31);
        y = 2 + rng() * 22;
      } else {
        x = 2 + rng() * (M - 4);
        y = 2 + rng() * (M - 4);
      }
      if (!free(x, y)) continue;
      const n: WorldNode = { t, mat, x, y, dead: 0, ...(bigChance > 0 && mat === 'wood' ? { big: rng() < bigChance } : {}) };
      nodes.push(n);
      objs.push(n);
      placed++;
    }
  };

  spawnNodes('wood', 'tree', 34, 0, 0.4);
  spawnNodes('ore', 'rock', 26, 0.78);
  spawnNodes('hay', 'hay', 26, 0.78);

  const interactables: Interactable[] = [
    { t: 'stable', x: 38, y: 37.5, label: 'Stable' },
    { t: 'bet', x: 19.7, y: 25.5, label: 'Betting booth' },
    { t: 'forge', x: 9, y: 32, label: 'Forge' },
    { t: 'market', x: 9, y: 35.5, label: 'Market' },
    { t: 'race', x: 19.8, y: 21.2, label: 'Race signup' },
    { t: 'shop', x: 45, y: 9.5, label: 'General store' },
    { t: 'wheel', x: 19.6, y: 23.8, label: 'Daily wheel' },
  ];

  const names: [string, number][] = [
    ['jigglz', 27], ['ac1978', 29], ['Xhrbes', 1], ['DoRiiToS', 22], ['moover22', 9], ['hankk', 14],
  ];
  const npcs: NpcWanderer[] = [];
  for (let i = 0; i < Math.min(npcWanderers, 6); i++) {
    npcs.push({
      x: 10 + rng() * 32,
      y: 8 + rng() * 30,
      tx: 20,
      ty: 20,
      wait: rng() * 3,
      name: names[i][0],
      lvl: names[i][1],
      shirt: NPC_SHIRT_COLORS[i],
    });
  }

  return { M, CX, CY, RX, RY, tiles, objs, nodes, interactables, npcs, pasturePlots: PASTURE_PLOTS };
}
