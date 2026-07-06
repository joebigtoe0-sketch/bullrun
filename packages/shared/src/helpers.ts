import type { Bull, GameItem, Interactable, PanelType, StatType } from './types.js';
import { INTERACT_USE_RANGE } from './constants.js';
import { normalizeStat, statCap, maxBullLevel, matNodeType, TRAIN_STAT_GAIN } from './stats.js';

export { isNearPasturePlot } from './pastures.js';
export { normalizeStat, statCap, maxBullLevel, matNodeType, TRAIN_STAT_GAIN } from './stats.js';

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export function eff(bull: Bull, stat: StatType, items: GameItem[]): number {
  let v = normalizeStat(bull[stat]);
  for (const it of items) {
    if (it.equippedTo === bull.id && it.bonus?.stat === stat) {
      v += normalizeStat(it.bonus.amt);
    }
  }
  return v;
}

export function coatOf(bull: Bull, items: GameItem[]): string {
  const c = items.find((it) => it.equippedTo === bull.id && it.slot === 'coat');
  return c ? c.color : bull.coat;
}

export function bullSlots(stableLevel: number): number {
  return 2 + Math.floor(stableLevel / 2);
}

export function stableWoodNeed(level: number): number {
  return 20 * level;
}

export function stableGoldNeed(level: number): number {
  return 50 * level;
}

export function energyRegen(stableLevel: number): number {
  return 0.15 * (1 + 0.5 * (stableLevel - 1));
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
