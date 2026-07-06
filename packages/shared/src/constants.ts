import type { MatType, NpcBull, RarityKey } from './types.js';

export const WORLD_SIZE = 56;
export const WORLD_CX = 28;
export const WORLD_CY = 23;
export const WORLD_RX = 14;
export const WORLD_RY = 9.5;
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
  { name: 'Thunder', owner: 'jigglz', coat: '#1d1a17', speed: 76, stamina: 72, accel: 64, temper: 3 },
  { name: 'Brisket', owner: 'ac1978', coat: '#6e4526', speed: 66, stamina: 80, accel: 62, temper: 2 },
  { name: 'Maximus', owner: 'DoRiiToS', coat: '#8e2f2f', speed: 70, stamina: 66, accel: 78, temper: 5 },
  { name: 'Clover', owner: 'Xhrbes', coat: '#e8e4da', speed: 62, stamina: 76, accel: 66, temper: 1 },
  { name: 'Diesel', owner: 'moover22', coat: '#3d3d45', speed: 68, stamina: 74, accel: 60, temper: 6 },
  { name: 'Peanut', owner: 'hankk', coat: '#c99a5b', speed: 67, stamina: 68, accel: 67, temper: 8 },
  { name: 'Rampage', owner: 'bullzeye', coat: '#472222', speed: 80, stamina: 62, accel: 70, temper: 7 },
  { name: 'Duchess', owner: 'mlk_2', coat: '#d9cbb8', speed: 64, stamina: 82, accel: 62, temper: 2 },
];

export const PURSE = [420, 280, 180, 120, 0, 0];
export const RACE_ENTRY_FEE = 0;
export const RACE_ENTRY_ENERGY = 100;
export const BULL_MAX_ENERGY = 100;
export const ENERGY_REGEN_BASE_PER_MIN = 3;
/** Server ticks energy this often — 1 energy per tick at stable level 1 (3/min). */
export const ENERGY_REGEN_TICK_MS = 20_000;
export const BREED_COST = 500;
export const BREED_DURATION_MS = 120_000;
export const REST_COST = 80;
export const REST_ENERGY = 50;
export const TRAIN_HAY_COST = 75;
export const FORGE_MIN_ORE = 100;
export const FORGE_MAX_ORE = 10_000;
export const GATHER_DURATION_MS = 1500;
export const NODE_RESPAWN_MS = 15_000;
export const MARKET_LIST_QUANTITIES = [100, 500, 1000] as const;
export const MARKET_FEE = 0.05;
/** Fair win payout multiplier after 5% house rake (odds = (1 / win%) × this). */
export const BET_HOUSE_EDGE = 1 - MARKET_FEE;
/** Monte Carlo trials when estimating bet odds from the race simulator. */
export const ODDS_SIM_TRIALS = 1500;
export const DEFAULT_RACE_INTERVAL_SEC = 360;
/** How long finished-race results stay painted on the track center (ms). */
export const RACE_RESULTS_DISPLAY_MS = 10_000;
export const CHAT_MAX_LEN = 120;
export const CHAT_LOG_MAX = 80;
export const CHAT_SPEECH_MS = 7_000;
export const CHAT_SPEECH_FADE_MS = 800;
export const DEFAULT_STARTING_GOLD = 0;
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
