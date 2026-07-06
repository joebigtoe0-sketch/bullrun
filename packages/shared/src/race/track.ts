import { WORLD_CX, WORLD_CY, WORLD_RX, WORLD_RY } from '../constants.js';

export const RACE_LAPS = 5;
/** Race times are multiplied by this (1.25 = 20% slower). */
export const RACE_DURATION_SCALE = 1.25;
export const RACE_GRID_MS = 10_000;

/** Base ms per lap before stat/luck adjustments. */
export const RACE_BASE_LAP_MS = 12_000 * RACE_DURATION_SCALE;

/** Max lap-to-lap spread (1st vs last on a single lap) grows toward the finish. */
export const RACE_LAP_SPREAD = [0.03, 0.04, 0.055, 0.075, 0.095] as const;

/** Slowest finisher vs winner total time (~1 lap behind when winner crosses on a 5-lap race). */
export const RACE_MAX_FINISH_GAP = 0.24;

export function raceStartLane(lane: number): number {
  return 0.88 + ((lane - 1) % 3) * 0.1;
}

export function raceProgressAt(elapsed: number, lapTimes: number[]): number {
  if (!lapTimes.length) return 0;
  let acc = 0;
  for (let i = 0; i < lapTimes.length; i++) {
    const lt = lapTimes[i];
    if (elapsed < acc + lt) {
      return (i + (elapsed - acc) / lt) / lapTimes.length;
    }
    acc += lt;
  }
  return 1;
}

export function raceBullAt(
  elapsed: number,
  finishT: number,
  lane: number,
  laps = RACE_LAPS,
  lapTimes?: number[],
): { x: number; y: number; facingLeft: boolean } {
  const totalProg = lapTimes?.length
    ? raceProgressAt(elapsed, lapTimes)
    : Math.min(1, Math.max(0, finishT > 0 ? elapsed / finishT : 0));
  const a = Math.PI / 2 + totalProg * Math.PI * 2 * laps;
  const er = raceStartLane(lane);
  const bx = WORLD_CX + Math.cos(a) * WORLD_RX * er;
  const by = WORLD_CY + Math.sin(a) * WORLD_RY * er;
  const tx = -Math.sin(a) * WORLD_RX * er;
  const ty = Math.cos(a) * WORLD_RY * er;
  return { x: bx, y: by, facingLeft: (tx - ty) * 32 < 0 };
}

/** Staggered grid slots on the start line before the race. */
export function raceGridPosition(
  slot: number,
  total: number,
): { x: number; y: number; facingLeft: boolean } {
  const a = Math.PI / 2 - (slot - 1) * 0.035;
  const er = raceStartLane(slot);
  const spread = (slot - (total + 1) / 2) * 0.28;
  const bx = WORLD_CX + Math.cos(a) * WORLD_RX * er + spread;
  const by = WORLD_CY + Math.sin(a) * WORLD_RY * er + spread * 0.35;
  return { x: bx, y: by, facingLeft: false };
}

export function currentLap(elapsed: number, finishT: number, laps = RACE_LAPS, lapTimes?: number[]): number {
  const totalProg = lapTimes?.length
    ? raceProgressAt(elapsed, lapTimes)
    : finishT <= 0 ? 0 : Math.min(1, Math.max(0, elapsed / finishT));
  return Math.min(laps, Math.floor(totalProg * laps) + 1);
}

export function scaledRaceFinishT(baseMs: number): number {
  return baseMs * RACE_LAPS * RACE_DURATION_SCALE;
}
