import type { Bull, GameItem, Interactable, PanelType, StatType } from './types.js';
import { ENERGY_REGEN_BASE_PER_MIN, ENERGY_REGEN_TICK_MS, INTERACT_USE_RANGE } from './constants.js';
import {
  normalizeStat,
  statCap,
  maxBullLevel,
  matNodeType,
  TRAIN_STAT_GAIN,
  trainHayCost,
  STAT_LEGACY_THRESHOLD,
  STAT_LEGACY_MULT,
} from './stats.js';

export { isNearPasturePlot } from './pastures.js';
export { normalizeStat, statCap, maxBullLevel, matNodeType, TRAIN_STAT_GAIN, trainHayCost } from './stats.js';

export function itemBonusAmt(amt: number): number {
  if (amt < STAT_LEGACY_THRESHOLD && amt <= 20) return amt * STAT_LEGACY_MULT;
  return amt;
}

export function bullBaseStat(bull: Bull, stat: StatType): number {
  return normalizeStat(bull[stat]);
}

export function bullItemBonus(bull: Bull, stat: StatType, items: GameItem[]): number {
  let bonus = 0;
  for (const it of items) {
    if (it.equippedTo === bull.id && it.bonus?.stat === stat) {
      bonus += itemBonusAmt(it.bonus.amt);
    }
  }
  return bonus;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export function eff(bull: Bull, stat: StatType, items: GameItem[]): number {
  return bullBaseStat(bull, stat) + bullItemBonus(bull, stat, items);
}

export function coatOf(bull: Bull, items: GameItem[]): string {
  const c = items.find((it) => it.equippedTo === bull.id && it.slot === 'coat');
  return c ? c.color : bull.coat;
}

export function bullSlots(stableLevel: number): number {
  return 2 + Math.floor(stableLevel / 2);
}

export function stableWoodNeed(level: number): number {
  return 35 * level * level;
}

/** Energy restored per minute (all bulls). Higher stable level = faster recovery. */
export function energyPerMinute(stableLevel: number): number {
  return ENERGY_REGEN_BASE_PER_MIN * (1 + 0.5 * Math.max(0, stableLevel - 1));
}

/** Energy restored each server tick (default: 1 at level 1 every 20s). */
export function energyPerTick(stableLevel: number): number {
  const perMin = energyPerMinute(stableLevel);
  return Math.max(1, Math.round((perMin * ENERGY_REGEN_TICK_MS) / 60_000));
}

/** @deprecated use energyPerMinute — kept for callers dividing per tick */
export function energyRegen(stableLevel: number): number {
  return energyPerMinute(stableLevel) / 60;
}

export function gridToWorld(x: number, y: number): [number, number, number] {
  const wx = (x - y) * 2;
  const wz = (x + y) * 1;
  return [wx, 0, wz];
}

export function worldToGrid(wx: number, wz: number): { x: number; y: number } {
  const x = (wx / 2 + wz) / 2;
  const y = (wz - wx / 2) / 2;
  return { x, y };
}

export {
  isTrackBlocked,
  isPastureFenceBlocked,
  isWorldBlocked,
  isWalkableCell,
  trackClamp,
  applyWorldCollision,
  findPath,
} from './navigation.js';

export function fmtCountdown(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Countdown for the next race — shows a friendly label once the clock hits zero. */
export function fmtRaceCountdown(startAtMs: number, now = Date.now()): string {
  const ms = startAtMs - now;
  if (ms <= 0) return 'Starting…';
  return fmtCountdown(ms);
}

export function nodeId(x: number, y: number, mat: string): string {
  return `${mat}:${x.toFixed(2)}:${y.toFixed(2)}`;
}

const BUILDING_PANELS = new Set<PanelType>(['stable', 'bet', 'market', 'forge', 'race', 'den']);

export function isBuildingPanel(panel: PanelType | null): panel is 'stable' | 'bet' | 'market' | 'forge' | 'race' | 'den' {
  return panel !== null && BUILDING_PANELS.has(panel);
}

export function isNearInteractable(
  px: number,
  py: number,
  type: 'stable' | 'bet' | 'market' | 'forge' | 'race',
  interactables: Interactable[],
  range = INTERACT_USE_RANGE,
): boolean {
  const it = interactables.find((i) => i.t === type);
  if (!it) return false;
  return Math.hypot(px - it.x, py - it.y) < range;
}
