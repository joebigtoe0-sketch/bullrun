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
      else if (e < 0.24) t = 'stone';
      tiles[x][y] = t;
    }
  }

  const path = (x: number, y: number) => {
    if (tiles[x]?.[y]?.startsWith('g')) tiles[x][y] = 'dirt';
  };
  for (let x = 3; x < 49; x++) { path(x, 38); path(x, 6); }
  for (let y = 6; y < 39; y++) { path(6, y); path(45, y); }
  for (let y = 33; y < 39; y++) path(26, y);

  const objs: WorldObject[] = [];
  const nodes: WorldNode[] = [];

  const fence = (er: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      objs.push({ t: 'post', x: CX + Math.cos(a) * RX * er, y: CY + Math.sin(a) * RY * er });
    }
  };
  for (const { er, n } of FENCE_RINGS) fence(er, n);

  objs.push({ t: 'booth', x: 13, y: 9, label: 'BETS' });
  objs.push({ t: 'market', x: 43, y: 17, label: 'MARKET' });
  objs.push({ t: 'forge', x: 9, y: 30, label: 'FORGE' });
  objs.push({ t: 'stable', x: 33, y: 38.5, label: 'YOUR STABLE' });
  objs.push({ t: 'sign', x: 26, y: 32.6, label: 'RACE SIGNUP' });

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

  let tries = 0;
  while (nodes.filter((n) => n.mat === 'wood').length < 34 && tries++ < 1400) {
    const x = 2 + rng() * (M - 4);
    const y = 2 + rng() * (M - 4);
    if (free(x, y)) {
      const n: WorldNode = { t: 'tree', mat: 'wood', x, y, dead: 0, big: rng() < 0.4 };
      nodes.push(n);
      objs.push(n);
    }
  }
  tries = 0;
  while (nodes.filter((n) => n.mat === 'ore').length < 14 && tries++ < 900) {
    const x = 2 + rng() * (M - 4);
    const y = 2 + rng() * (M - 4);
    if (free(x, y)) {
      const n: WorldNode = { t: 'rock', mat: 'ore', x, y, dead: 0 };
      nodes.push(n);
      objs.push(n);
    }
  }
  tries = 0;
  while (nodes.filter((n) => n.mat === 'hay').length < 14 && tries++ < 900) {
    const x = 2 + rng() * (M - 4);
    const y = 2 + rng() * (M - 4);
    if (free(x, y)) {
      const n: WorldNode = { t: 'hay', mat: 'hay', x, y, dead: 0 };
      nodes.push(n);
      objs.push(n);
    }
  }

  const interactables: Interactable[] = [
    { t: 'stable', x: 33, y: 40, label: 'Stable' },
    { t: 'bet', x: 13, y: 10.5, label: 'Betting booth' },
    { t: 'market', x: 43, y: 18.5, label: 'Market' },
    { t: 'forge', x: 9, y: 31.5, label: 'Forge' },
    { t: 'race', x: 26, y: 33.4, label: 'Race signup' },
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
