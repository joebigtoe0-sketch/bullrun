import { WORLD_CX, WORLD_CY, WORLD_RX, WORLD_RY } from '../constants.js';

export const RACE_LAPS = 5;
/** Race times are multiplied by this (1.25 = 20% slower). */
export const RACE_DURATION_SCALE = 1.25;
export const RACE_GRID_MS = 10_000;

/** Base ms per lap before stat/luck adjustments. */
export const RACE_BASE_LAP_MS = 12_000 * RACE_DURATION_SCALE;

/** Max lap-to-lap spread (1st vs last on a single lap) grows toward the finish. */
export const RACE_LAP_SPREAD = [0.04, 0.055, 0.075, 0.095, 0.12] as const;

/** Slowest finisher vs winner total time (~1 lap behind when winner crosses on a 5-lap race). */
export const RACE_MAX_FINISH_GAP = 0.24;

/** Single oval racers follow — lap times are stat-based, not lane distance. */
export const RACE_TRACK_ER = 0.93;

export function raceStartLane(lane: number): number {
  return 0.88 + ((lane - 1) % 3) * 0.1;
}

export function formatRaceLapLabel(lap: number, laps = RACE_LAPS): string {
  if (lap >= laps) return 'LAST LAP';
  return `LAP ${lap}/${laps}`;
}

export interface LiveStanding {
  pos: number;
  name: string;
  finished: boolean;
}

export function formatLiveStandingLine(s: LiveStanding): string {
  return s.finished ? `${s.pos}. ${s.name}` : `… ${s.name}`;
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

/** Hold grid formation briefly after the flag, then blend onto the racing line. */
const GRID_HOLD_MS = 2000;

/** Finish-line layout — same geometry as the starting grid (white line on the straight). */
export function raceFinishPosition(
  slot: number,
  fieldSize: number,
): { x: number; y: number; facingLeft: boolean } {
  const gridAngleOffset = (slot - 1) * 0.035;
  const spread = (slot - (fieldSize + 1) / 2) * 0.28;
  const laneEr = raceStartLane(slot);
  const a = Math.PI / 2 - gridAngleOffset;
  const bx = WORLD_CX + Math.cos(a) * WORLD_RX * laneEr + spread;
  const by = WORLD_CY + Math.sin(a) * WORLD_RY * laneEr + spread * 0.35;
  const tx = -Math.sin(a) * WORLD_RX * laneEr;
  const ty = Math.cos(a) * WORLD_RY * laneEr;
  return { x: bx, y: by, facingLeft: (tx - ty) * 32 < 0 };
}

export function raceBullAt(
  elapsed: number,
  finishT: number,
  slot: number,
  laps = RACE_LAPS,
  lapTimes?: number[],
  fieldSize = 6,
): { x: number; y: number; facingLeft: boolean } {
  const t = Math.max(0, elapsed);
  if (finishT > 0 && t >= finishT) {
    return raceFinishPosition(slot, fieldSize);
  }

  const totalProg = lapTimes?.length
    ? raceProgressAt(t, lapTimes)
    : Math.min(1, Math.max(0, finishT > 0 ? t / finishT : 0));
  const prog = Math.min(1, Math.max(0, totalProg));

  const gridAngleOffset = (slot - 1) * 0.035;
  const spread = (slot - (fieldSize + 1) / 2) * 0.28;
  const spreadFade = t < GRID_HOLD_MS ? 0 : Math.min(1, prog * 40);
  const laneEr = raceStartLane(slot);
  const er = laneEr + (RACE_TRACK_ER - laneEr) * spreadFade;

  const a =
    Math.PI / 2 -
    gridAngleOffset * (1 - spreadFade) +
    prog * Math.PI * 2 * laps;
  const spreadX = spread * (1 - spreadFade);
  const spreadY = spread * 0.35 * (1 - spreadFade);
  const bx = WORLD_CX + Math.cos(a) * WORLD_RX * er + spreadX;
  const by = WORLD_CY + Math.sin(a) * WORLD_RY * er + spreadY;
  const tx = -Math.sin(a) * WORLD_RX * er;
  const ty = Math.cos(a) * WORLD_RY * er;
  return { x: bx, y: by, facingLeft: (tx - ty) * 32 < 0 };
}

/** Staggered grid slots on the start line before the race. */
export function raceGridPosition(
  slot: number,
  total: number,
): { x: number; y: number; facingLeft: boolean } {
  return raceFinishPosition(slot, total);
}

export function currentLap(elapsed: number, finishT: number, laps = RACE_LAPS, lapTimes?: number[]): number {
  const t = Math.max(0, elapsed);
  const totalProg = lapTimes?.length
    ? raceProgressAt(t, lapTimes)
    : finishT <= 0 ? 0 : Math.min(1, Math.max(0, t / finishT));
  return Math.min(laps, Math.max(1, Math.floor(Math.max(0, totalProg) * laps) + 1));
}

export function scaledRaceFinishT(baseMs: number): number {
  return baseMs * RACE_LAPS * RACE_DURATION_SCALE;
}
