import type { Bull, GameItem, NpcBull, RaceBull, RaceResult } from '../types.js';
import { eff, coatOf } from '../helpers.js';
import { normalizeStat } from '../stats.js';
import { NPC_POOL } from '../constants.js';
import { BET_HOUSE_EDGE, ODDS_SIM_TRIALS } from '../constants.js';
import { racePrizeForPosition } from './prizes.js';
import {
  RACE_BASE_LAP_MS,
  RACE_LAP_SPREAD,
  RACE_LAPS,
  RACE_MAX_FINISH_GAP,
  raceProgressAt,
  type LiveStanding,
} from './track.js';

export type { LiveStanding } from './track.js';
export { formatLiveStandingLine } from './track.js';

export function raceScore(bull: Bull, items: GameItem[]): number {
  return eff(bull, 'speed', items) * 1.0 + eff(bull, 'stamina', items) * 0.8 + eff(bull, 'accel', items) * 0.6;
}

export function npcScore(bull: { speed: number; stamina: number; accel: number }): number {
  const s = normalizeStat(bull.speed);
  const st = normalizeStat(bull.stamina);
  const a = normalizeStat(bull.accel);
  return s * 0.4 + st * 0.35 + a * 0.25;
}

function raceLuckRoll(): number {
  return ((Math.random() + Math.random() + Math.random()) / 3) * 2 - 1;
}

interface ResolvedStats {
  speed: number;
  stamina: number;
  accel: number;
  energy: number;
  temper: number;
}

function resolveStats(b: RaceBull, items: GameItem[]): ResolvedStats {
  if (b.isNpc) {
    return {
      speed: normalizeStat(b.speed),
      stamina: normalizeStat(b.stamina),
      accel: normalizeStat(b.accel),
      energy: 68 + (b.temper ?? 3) * 4,
      temper: b.temper ?? 3,
    };
  }
  const bull = b as Bull;
  const mine = items.filter((it) => it.equippedTo === bull.id);
  return {
    speed: eff(bull, 'speed', mine),
    stamina: eff(bull, 'stamina', mine),
    accel: eff(bull, 'accel', mine),
    energy: bull.energy ?? 75,
    temper: bull.temper ?? 3,
  };
}

/** Per-lap competitiveness — accel matters early, stamina late, energy fades on final laps. */
function lapScore(stats: ResolvedStats, lap: number, laps: number): number {
  const f = laps <= 1 ? 0 : lap / (laps - 1);
  let score =
    stats.speed * (0.55 + 0.22 * f) +
    stats.stamina * (0.18 + 0.62 * f) +
    stats.accel * (0.95 - 0.58 * f);

  if (f > 0.35) {
    const fade = 1 - Math.max(0, (55 - stats.energy) / 120) * (f - 0.35) * 1.1;
    score *= Math.max(0.82, fade);
  }

  // lap-to-lap drama scales with the score itself (stats are ~60–200)
  score *= 1 + raceLuckRoll() * 0.1 + (Math.random() - 0.5) * 0.015 * stats.temper;
  return score;
}

function overallPower(stats: ResolvedStats): number {
  return stats.speed * 0.38 + stats.stamina * 0.34 + stats.accel * 0.28;
}

/**
 * How much of the field's typical (compressed) power race-day luck can swing.
 * Stats live on a ~60–200 scale, so power is sqrt-compressed first: small stat
 * leads give a small edge, and even a maxed legendary vs fresh bulls is only a
 * ~70–75% favorite, never a lock.
 */
const RACE_LUCK_POWER_FRAC = 0.9;

type RaceArc = 'steady' | 'earlyBurst' | 'midBurst' | 'lateSurge' | 'fader';

function computeTargetFinishOrder(statsList: ResolvedStats[]): number[] {
  const powers = statsList.map((st) => Math.sqrt(overallPower(st)));
  const avg = powers.reduce((a, c) => a + c, 0) / (powers.length || 1);
  const luck = Math.max(0.5, avg * RACE_LUCK_POWER_FRAC);
  return powers
    .map((p, i) => ({ i, p: p + raceLuckRoll() * luck }))
    .sort((a, b) => b.p - a.p)
    .map((x) => x.i);
}

function assignRaceArcs(n: number, finishOrder: number[]): RaceArc[] {
  const arcs: RaceArc[] = Array(n).fill('steady');
  if (n < 2) return arcs;

  const winner = finishOrder[0]!;
  const others = finishOrder.slice(1);

  arcs[finishOrder[1]!] = 'lateSurge';

  if (others.length > 1) {
    arcs[others[1]!] = 'earlyBurst';
  }
  if (others.length > 2) {
    arcs[others[2]!] = 'midBurst';
  }
  if (others.length > 3) {
    arcs[others[3]!] = 'fader';
  }

  if (Math.random() < 0.55) {
    arcs[winner] = 'lateSurge';
  }

  return arcs;
}

function arcModifier(arc: RaceArc, lap: number, laps: number): number {
  const f = laps <= 1 ? 0 : lap / (laps - 1);
  switch (arc) {
    case 'earlyBurst':
      return lap <= 0 ? 1.18 : lap === 1 ? 1.1 : lap === 2 ? 0.86 : 0.96;
    case 'midBurst':
      return lap === 2 ? 1.2 : lap === 3 ? 0.88 : lap === 1 ? 1.04 : 0.94;
    case 'lateSurge':
      if (f < 0.55) return 0.92 + f * 0.08;
      return 1 + ((f - 0.55) / 0.45) * 0.22;
    case 'fader':
      return lap <= 1 ? 1.1 : lap <= 3 ? 0.84 : 0.92 + f * 0.06;
    default:
      return 1;
  }
}

/** Lock final order with tight 1–2 gap and wider gaps behind — last-lap times absorb the tweak. */
function finalizeFinishTimes(lapTimes: number[][], finishOrder: number[]): void {
  const last = lapTimes[0]!.length - 1;
  const prefix = (idx: number) => lapTimes[idx]!.slice(0, last).reduce((a, c) => a + c, 0);

  const winnerIdx = finishOrder[0]!;
  const winnerPrefix = prefix(winnerIdx);
  const winnerLastBase = RACE_BASE_LAP_MS * (0.9 + Math.random() * 0.08);
  lapTimes[winnerIdx]![last] = winnerLastBase;

  let cursor = winnerPrefix + winnerLastBase;
  const gap12 = 70 + Math.random() * 1300;

  for (let p = 1; p < finishOrder.length; p++) {
    const idx = finishOrder[p]!;
    const gap = p === 1 ? gap12 : 320 + Math.random() * 780;
    cursor += gap;
    lapTimes[idx]![last] = Math.max(RACE_BASE_LAP_MS * 0.86, cursor - prefix(idx));
  }
}

function splitRaceField(field: RaceBull[]): { players: RaceBull[]; npcs: NpcBull[] } {
  const players: RaceBull[] = [];
  const npcs: NpcBull[] = [];
  for (const b of field.slice(0, 6)) {
    if (b.isNpc) npcs.push(b as NpcBull);
    else players.push(b);
  }
  return { players, npcs };
}

/** Win probability per field slot via Monte Carlo using the real race simulator. */
export function winProbabilities(
  field: RaceBull[],
  items: GameItem[] = [],
  trials = ODDS_SIM_TRIALS,
): number[] {
  const { players, npcs } = splitRaceField(field);
  const ordered = [...players, ...npcs].slice(0, 6);
  const n = ordered.length;
  if (n === 0) return [];

  const wins = new Array<number>(n).fill(0);
  for (let t = 0; t < trials; t++) {
    const { bulls } = simulateRace(players, npcs, items);
    const winner = bulls.find((b) => b.pos === 1);
    if (!winner) continue;
    const winIdx = ordered.findIndex((b) => String(b.id) === String(winner.id));
    if (winIdx >= 0) wins[winIdx]++;
  }

  const total = wins.reduce((a, c) => a + c, 0) || 1;
  return wins.map((w) => w / total);
}

export function oddsFromProbabilities(
  probs: number[],
  houseEdge = BET_HOUSE_EDGE,
  minOdds = 1.05,
  maxOdds = 12,
): number[] {
  // Only a bull racing alone (a guaranteed win) pays below even money;
  // in a real field even the heaviest favorite pays above 1x.
  const solo = probs.length <= 1;
  return probs.map((p) => {
    if (p <= 0) return maxOdds;
    const fair = 1 / p;
    const withEdge = fair * houseEdge;
    if (solo && withEdge < 1) return Math.max(0.85, Math.round(withEdge * 100) / 100);
    return Math.min(maxOdds, Math.max(minOdds, Math.round(withEdge * 100) / 100));
  });
}

/** Decimal odds from simulated win chances (includes house rake). */
export function odds(
  field: RaceBull[],
  items: GameItem[] = [],
  trials = ODDS_SIM_TRIALS,
): number[] {
  const probs = winProbabilities(field, items, trials);
  return oddsFromProbabilities(probs);
}

export function simulateRace(
  playerBulls: RaceBull[],
  npcField: NpcBull[],
  items: GameItem[] = [],
): { bulls: RaceBull[]; endT: number } {
  const mine = playerBulls.map((b) => ({
    ...b,
    speed: b.isNpc ? b.speed : eff(b as Bull, 'speed', items),
    stamina: b.isNpc ? b.stamina : eff(b as Bull, 'stamina', items),
    accel: b.isNpc ? b.accel : eff(b as Bull, 'accel', items),
    coat: b.isNpc ? b.coat : coatOf(b as Bull, items),
    owner: b.owner || 'You',
    isMine: true,
  }));
  const field = [...mine, ...npcField].slice(0, 6);
  const laps = RACE_LAPS;
  const n = field.length;
  if (n === 0) return { bulls: [], endT: 0 };

  const statsList = field.map((b) => resolveStats(b, items));
  const lapTimes: number[][] = field.map(() => []);
  const finishOrder = computeTargetFinishOrder(statsList);
  const arcs = assignRaceArcs(n, finishOrder);
  const winnerIdx = finishOrder[0]!;

  for (let lap = 0; lap < laps; lap++) {
    const isLast = lap === laps - 1;
    const spreadFrac = RACE_LAP_SPREAD[Math.min(lap, RACE_LAP_SPREAD.length - 1)];
    const spreadMs = RACE_BASE_LAP_MS * spreadFrac * (isLast ? 1.35 : 1);

    const ranked = statsList
      .map((st, i) => {
        let s = lapScore(st, lap, laps) * arcModifier(arcs[i]!, lap, laps);
        if (isLast && i === winnerIdx) s *= 1.1;
        if (isLast && i === finishOrder[1]) s *= 1.06;
        s *= 1 + (Math.random() - 0.5) * (isLast ? 0.1 : 0.16);
        return { i, s };
      })
      .sort((a, b) => b.s - a.s);

    ranked.forEach((entry, rank) => {
      const jitter = (Math.random() - 0.5) * spreadMs * 0.22;
      const t = RACE_BASE_LAP_MS + (n > 1 ? (rank / (n - 1)) * spreadMs : 0) + jitter;
      lapTimes[entry.i]!.push(Math.max(RACE_BASE_LAP_MS * 0.9, t));
    });
  }

  finalizeFinishTimes(lapTimes, finishOrder);

  const totals = lapTimes.map((lt) => lt.reduce((a, c) => a + c, 0));
  const minTotal = Math.min(...totals);
  const maxAllowed = minTotal * (1 + RACE_MAX_FINISH_GAP);
  for (let i = 0; i < n; i++) {
    if (totals[i]! > maxAllowed) {
      const scale = maxAllowed / totals[i]!;
      lapTimes[i] = lapTimes[i]!.map((t) => t * scale);
      totals[i] = maxAllowed;
    }
  }

  const posById = new Map<number, number>();
  finishOrder.forEach((idx, p) => posById.set(idx, p + 1));

  const scored: RaceBull[] = field.map((b, i) => ({
    ...b,
    lapTimes: lapTimes[i],
    finishT: totals[i],
    score: overallPower(statsList[i]!) + raceLuckRoll() * 3,
    pos: posById.get(i) ?? n,
  }));

  scored.sort((a, b) => (a.finishT ?? 0) - (b.finishT ?? 0));

  const endT = Math.max(...totals);
  return { bulls: scored, endT };
}

export function buildRaceResults(
  bulls: RaceBull[],
  myBullIds: number[],
): RaceResult[] {
  const sorted = [...bulls].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  const fieldSize = sorted.length;
  return sorted.map((r) => ({
    name: r.name,
    owner: r.owner || '',
    pos: r.pos ?? 0,
    prize: racePrizeForPosition(r.pos ?? 0, fieldSize),
    mine: myBullIds.includes(r.id as number),
  }));
}

export interface LiveStandingInput {
  name: string;
  finishT?: number;
  lapTimes?: number[];
}

export function liveStandings(bulls: LiveStandingInput[], elapsed: number): LiveStanding[] {
  const finished = bulls
    .filter((b) => elapsed >= (b.finishT ?? Infinity))
    .sort((a, b) => (a.finishT ?? 0) - (b.finishT ?? 0))
    .map((b, i) => ({ pos: i + 1, name: b.name, finished: true }));

  const racing = bulls
    .filter((b) => elapsed < (b.finishT ?? Infinity))
    .map((b) => ({
      b,
      p: b.lapTimes?.length
        ? raceProgressAt(elapsed, b.lapTimes)
        : Math.min(1, elapsed / (b.finishT ?? 1)),
    }))
    .sort((a, c) => c.p - a.p);

  return [
    ...finished,
    ...racing.map((x, i) => ({
      pos: finished.length + i + 1,
      name: x.b.name,
      finished: false,
    })),
  ];
}

export function pickNpcField(count = 5): NpcBull[] {
  const pool = [...NPC_POOL].sort(() => Math.random() - 0.5);
  return pool.slice(0, count).map((n, i) => ({ ...n, id: `npc${i}`, isNpc: true as const }));
}
