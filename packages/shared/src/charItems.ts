import type { CharSlot, CharStatType, GameItem, RarityKey } from './types.js';
import { RARITIES } from './constants.js';
import { GATHER_DURATION_MS } from './constants.js';

/** Base click-to-move walk speed (world units / s). */
export const BASE_MOVE_SPEED = 4.4;

/** Tokens required in wallet to spin the daily wheel. */
export const WHEEL_MIN_TOKENS = 10_000;

export const CHAR_SLOTS: CharSlot[] = ['hat', 'outfit', 'boots', 'gloves'];

export const CHAR_SLOT_LABEL: Record<CharSlot, string> = {
  hat: 'Hat',
  outfit: 'Outfit',
  boots: 'Boots',
  gloves: 'Gloves',
};

export const CHAR_STAT_LABEL: Record<CharStatType, string> = {
  speed: 'walk speed',
  wood: 'wood cutting',
  ore: 'mining',
  hay: 'hay gathering',
};

export function isCharSlot(slot: string): slot is CharSlot {
  return (CHAR_SLOTS as string[]).includes(slot);
}

export function rarityColor(rarity: RarityKey): string {
  return RARITIES.find((r) => r.k === rarity)?.c ?? '#c9b896';
}

export interface StoreItemDef {
  sku: string;
  name: string;
  slot: CharSlot;
  rarity: RarityKey;
  color: string;
  price: number;
  bonus: { stat: CharStatType; amt: number };
}

/** General store catalog — character clothing with % bonuses. */
export const STORE_CATALOG: StoreItemDef[] = [
  // hats — walk speed
  { sku: 'hat-straw', name: 'Straw Hat', slot: 'hat', rarity: 'Common', color: '#d9b45a', price: 150, bonus: { stat: 'speed', amt: 4 } },
  { sku: 'hat-scout', name: 'Scout Cap', slot: 'hat', rarity: 'Uncommon', color: '#5a7a3a', price: 450, bonus: { stat: 'speed', amt: 8 } },
  { sku: 'hat-drifter', name: 'Drifter Stetson', slot: 'hat', rarity: 'Rare', color: '#6b4a33', price: 1200, bonus: { stat: 'speed', amt: 14 } },
  // outfits — split bonuses
  { sku: 'outfit-lumber', name: 'Lumberjack Flannel', slot: 'outfit', rarity: 'Uncommon', color: '#a53a2e', price: 500, bonus: { stat: 'wood', amt: 12 } },
  { sku: 'outfit-miner', name: 'Miner Overalls', slot: 'outfit', rarity: 'Uncommon', color: '#4a5a6e', price: 500, bonus: { stat: 'ore', amt: 12 } },
  { sku: 'outfit-farmer', name: 'Farmhand Denim', slot: 'outfit', rarity: 'Uncommon', color: '#3b6ea5', price: 500, bonus: { stat: 'hay', amt: 12 } },
  { sku: 'outfit-ranger', name: 'Ranger Duster', slot: 'outfit', rarity: 'Epic', color: '#3a2a1a', price: 2800, bonus: { stat: 'speed', amt: 18 } },
  // boots — walk speed
  { sku: 'boots-work', name: 'Work Boots', slot: 'boots', rarity: 'Common', color: '#8a6538', price: 120, bonus: { stat: 'speed', amt: 3 } },
  { sku: 'boots-swift', name: 'Swiftstep Boots', slot: 'boots', rarity: 'Rare', color: '#c9573f', price: 1100, bonus: { stat: 'speed', amt: 10 } },
  // gloves — gather speed
  { sku: 'gloves-leather', name: 'Leather Gloves', slot: 'gloves', rarity: 'Common', color: '#a5764a', price: 120, bonus: { stat: 'wood', amt: 6 } },
  { sku: 'gloves-pick', name: 'Prospector Grips', slot: 'gloves', rarity: 'Rare', color: '#5fb4d8', price: 1000, bonus: { stat: 'ore', amt: 16 } },
  { sku: 'gloves-hay', name: 'Baler Mitts', slot: 'gloves', rarity: 'Rare', color: '#e0c96a', price: 1000, bonus: { stat: 'hay', amt: 16 } },
];

/** Wheel jackpot pool — rare/legendary char clothing (bull gear is rolled separately). */
export const WHEEL_JACKPOT_CLOTHING: Omit<StoreItemDef, 'price'>[] = [
  { sku: 'hat-gold', name: 'Gilded Stetson', slot: 'hat', rarity: 'Legendary', color: '#f2b23a', bonus: { stat: 'speed', amt: 25 } },
  { sku: 'outfit-baron', name: 'Cattle Baron Coat', slot: 'outfit', rarity: 'Legendary', color: '#8e3b2e', bonus: { stat: 'speed', amt: 22 } },
  { sku: 'gloves-midas', name: 'Midas Grips', slot: 'gloves', rarity: 'Legendary', color: '#f2c94c', bonus: { stat: 'ore', amt: 30 } },
  { sku: 'boots-comet', name: 'Comet Runners', slot: 'boots', rarity: 'Epic', color: '#c86ad4', bonus: { stat: 'speed', amt: 16 } },
  { sku: 'hat-frontier', name: 'Frontier Marshal Hat', slot: 'hat', rarity: 'Epic', color: '#3a3a3d', bonus: { stat: 'speed', amt: 15 } },
];

/** Wheel gold prize tiers: [weight, min, max]. Jackpot handled separately. */
export const WHEEL_GOLD_TIERS: { weight: number; min: number; max: number; label: string }[] = [
  { weight: 55, min: 25, max: 75, label: 'Small gold' },
  { weight: 27, min: 100, max: 250, label: 'Gold pouch' },
  { weight: 12, min: 400, max: 800, label: 'Big gold' },
  { weight: 4, min: 1200, max: 2000, label: 'Huge gold' },
];
/** Chance (of 100) that a spin hits the daily item jackpot. */
export const WHEEL_JACKPOT_WEIGHT = 2;

/** Sum of equipped character-item % bonuses for a stat. */
export function charBonusPct(items: GameItem[], stat: CharStatType): number {
  let pct = 0;
  for (const it of items) {
    if (it.kind === 'char' && it.equipped && it.bonus && it.bonus.stat === (stat as string)) {
      pct += it.bonus.amt;
    }
  }
  return pct;
}

/** Click-to-move speed with equipped clothing bonuses (capped at +60%). */
export function moveSpeedFor(items: GameItem[]): number {
  const pct = Math.min(60, charBonusPct(items, 'speed'));
  return BASE_MOVE_SPEED * (1 + pct / 100);
}

/** Gather duration for a material with equipped clothing bonuses (capped at +70% speed). */
export function gatherDurationFor(items: GameItem[], mat: string | undefined): number {
  if (mat !== 'wood' && mat !== 'ore' && mat !== 'hay') return GATHER_DURATION_MS;
  const pct = Math.min(70, charBonusPct(items, mat));
  return Math.round(GATHER_DURATION_MS / (1 + pct / 100));
}
