import { WORLD_CX, WORLD_CY, WORLD_RX, WORLD_RY } from '../constants.js';

export const RACE_LAPS = 5;
/** Race times are multiplied by this (1.25 = 20% slower). */
export const RACE_DURATION_SCALE = 1.25;
export const RACE_GRID_MS = 10_000;

export function raceStartLane(lane: number): number {
  return 0.88 + ((lane - 1) % 3) * 0.1;
}

export function raceBullAt(
  elapsed: number,
  finishT: number,
  lane: number,
  laps = RACE_LAPS,
): { x: number; y: number; facingLeft: boolean } {
  const totalProg = Math.min(1, Math.max(0, elapsed / finishT));
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

export function currentLap(elapsed: number, finishT: number, laps = RACE_LAPS): number {
  if (finishT <= 0) return 1;
  const totalProg = Math.min(1, Math.max(0, elapsed / finishT));
  return Math.min(laps, Math.floor(totalProg * laps) + 1);
}

export function scaledRaceFinishT(baseMs: number): number {
  return baseMs * RACE_LAPS * RACE_DURATION_SCALE;
}
