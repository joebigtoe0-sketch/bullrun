/** Character (rancher) leveling — XP comes from gathering: 1 XP per resource unit. */

export const MAX_CHAR_LEVEL = 25;

/** XP needed to go from `level` to `level + 1` (1000, ~1450, ~2000, … much steeper later). */
export function xpNeedForLevel(level: number): number {
  if (level >= MAX_CHAR_LEVEL) return 0;
  return Math.round(1000 * Math.pow(1.4, level - 1));
}

/** How many bulls can follow at a character level: 1 → 2 at Lv10 → 3 at Lv25. */
export function maxFollowingForLevel(level: number): number {
  if (level >= 25) return 3;
  if (level >= 10) return 2;
  return 1;
}

/** Extra resources per gather from character level (+1 every 5 levels). */
export function gatherBonusQty(level: number): number {
  return Math.floor(level / 5);
}

/** Apply an XP gain, handling multi-level-ups and the level cap. */
export function applyXpGain(
  level: number,
  xp: number,
  gain: number,
): { level: number; xp: number; leveledUp: boolean } {
  let l = level;
  let x = xp + gain;
  let leveledUp = false;
  while (l < MAX_CHAR_LEVEL && x >= xpNeedForLevel(l)) {
    x -= xpNeedForLevel(l);
    l++;
    leveledUp = true;
  }
  if (l >= MAX_CHAR_LEVEL) x = 0;
  return { level: l, xp: x, leveledUp };
}
