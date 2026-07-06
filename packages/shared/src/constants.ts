import type { MatType, NpcBull, RarityKey } from './types.js';

export const WORLD_SIZE = 52;
export const WORLD_CX = 26;
export const WORLD_CY = 22;
export const WORLD_RX = 13;
export const WORLD_RY = 9;
export const WORLD_SEED = 42;

export const TILE_COLORS: Record<string, string> = {
  g1: '#7cbf54',
  g2: '#74b64d',
  dirt: '#b58a5a',
  stone: '#c2c2bd',
  trk1: '#cfa871',
  trk2: '#c69e66',
};

export const RARITIES: { k: RarityKey; c: string }[] = [
  { k: 'Common', c: '#c9b896' },
  { k: 'Uncommon', c: '#7dc24f' },
  { k: 'Rare', c: '#5fb4d8' },
  { k: 'Epic', c: '#c86ad4' },
  { k: 'Legendary', c: '#f2b23a' },
];

export const NPC_POOL: Omit<NpcBull, 'id' | 'isNpc'>[] = [
  { name: 'Thunder', owner: 'jigglz', coat: '#1d1a17', speed: 8, stamina: 6, accel: 5, temper: 3 },
  { name: 'Brisket', owner: 'ac1978', coat: '#6e4526', speed: 6, stamina: 8, accel: 5, temper: 2 },
  { name: 'Maximus', owner: 'DoRiiToS', coat: '#8e2f2f', speed: 7, stamina: 5, accel: 8, temper: 5 },
  { name: 'Clover', owner: 'Xhrbes', coat: '#e8e4da', speed: 5, stamina: 7, accel: 6, temper: 1 },
  { name: 'Diesel', owner: 'moover22', coat: '#3d3d45', speed: 7, stamina: 7, accel: 4, temper: 6 },
  { name: 'Peanut', owner: 'hankk', coat: '#c99a5b', speed: 6, stamina: 6, accel: 6, temper: 8 },
  { name: 'Rampage', owner: 'bullzeye', coat: '#472222', speed: 9, stamina: 4, accel: 6, temper: 7 },
  { name: 'Duchess', owner: 'mlk_2', coat: '#d9cbb8', speed: 5, stamina: 9, accel: 5, temper: 2 },
];

export const PURSE = [300, 150, 80, 40];
export const RACE_ENTRY_FEE = 50;
export const RACE_ENTRY_ENERGY = 30;
export const BREED_COST = 200;
export const BREED_DURATION_MS = 8000;
export const REST_COST = 40;
export const REST_ENERGY = 40;
export const TRAIN_HAY_COST = 6;
export const GATHER_DURATION_MS = 1500;
export const NODE_RESPAWN_MS = 25000;
export const MARKET_LIST_QTY = 10;
export const MARKET_FEE = 0.05;
export const DEFAULT_RACE_INTERVAL_SEC = 120;
export const DEFAULT_STARTING_GOLD = 500;
export const INTERACT_USE_RANGE = 2.5;
export const INTERACT_CLICK_RANGE = 1.6;

/** Fence rings around the race track (er = ellipse ratio, n = post count). */
export const FENCE_RINGS = [
  { er: 0.78, n: 40 },
  { er: 1.235, n: 60 },
] as const;

export const MAT_RATES: Record<MatType, number> = { hay: 3, ore: 8, wood: 5 };
export const MAT_SWATCHES: Record<MatType, string> = { hay: '#d9c65a', ore: '#9aa0a6', wood: '#8a5a2b' };

export const NPC_SHIRT_COLORS = ['#4a72c4', '#c4574a', '#4ac47e', '#c4a94a', '#8a4ac4', '#4ac4bb'];
export const COAT_COLORS = ['#8e2f2f', '#e8e4da', '#14141a', '#3b6ea5', '#c99a5b', '#7a5296'];
export const CALF_NAMES = ['Rowdy', 'Biscuit', 'Comet', 'Waffle', 'Tornado', 'Mocha', 'Zippy', 'Boulder'];
export const SHOP_BULL_NAMES = ['Bandit', 'Ember', 'Chief', 'Juniper', 'Rocco', 'Sage', 'Nitro', 'Poppy'];
export const SHOP_COATS = ['#1d1a17', '#6e4526', '#8e2f2f', '#c99a5b', '#3d3d45', '#d9cbb8'];
export const SHOP_SELLERS = ['hankk', 'bullzeye', 'mlk_2', 'ac1978'];

export const NPC_CATALOG = [
  { name: 'Hay Bundle ×10', mat: 'hay' as MatType, rarity: 'Common' as RarityKey, rarityColor: '#c9b896', price: 35, desc: 'Materials · seller: hankk', swatch: '#d9c65a' },
  { name: 'Wood Bundle ×10', mat: 'wood' as MatType, rarity: 'Common' as RarityKey, rarityColor: '#c9b896', price: 55, desc: 'Materials · seller: ac1978', swatch: '#8a5a2b' },
  { name: 'Ore Bundle ×10', mat: 'ore' as MatType, rarity: 'Common' as RarityKey, rarityColor: '#c9b896', price: 85, desc: 'Materials · seller: bullzeye', swatch: '#9aa0a6' },
];

export const ISO_SCALE_X = 2;
export const ISO_SCALE_Z = 1;
export const VOXEL_UNIT = 0.5;
