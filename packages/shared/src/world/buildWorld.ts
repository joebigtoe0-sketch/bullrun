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
  for (let y = 35; y < 41; y++) path(24, y);
  for (let x = 6; x <= 32; x++) path(x, 37);

  const objs: WorldObject[] = [];
  const nodes: WorldNode[] = [];

  const fence = (er: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      objs.push({ t: 'post', x: CX + Math.cos(a) * RX * er, y: CY + Math.sin(a) * RY * er });
    }
  };
  for (const { er, n } of FENCE_RINGS) fence(er, n);

  objs.push({ t: 'booth', x: 31, y: 37.2, label: 'BETS' });
  objs.push({ t: 'forge', x: 9, y: 32, label: 'FORGE' });
  objs.push({ t: 'market', x: 9, y: 35.5, label: 'MARKET' });
  objs.push({ t: 'stable', x: 38, y: 37.5, label: 'YOUR STABLE' });
  objs.push({ t: 'raceBooth', x: 24, y: 37.5, label: 'RACE SIGNUP' });

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
    { t: 'bet', x: 31, y: 37.2, label: 'Betting booth' },
    { t: 'forge', x: 9, y: 32, label: 'Forge' },
    { t: 'market', x: 9, y: 35.5, label: 'Market' },
    { t: 'race', x: 24, y: 37.5, label: 'Race signup' },
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
