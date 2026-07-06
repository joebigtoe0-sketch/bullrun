import type { Bull, GameItem, NpcBull, RaceBull, RaceResult } from '../types.js';
import { eff, coatOf } from '../helpers.js';
import { normalizeStat } from '../stats.js';
import { NPC_POOL, PURSE } from '../constants.js';
import {
  RACE_BASE_LAP_MS,
  RACE_LAP_SPREAD,
  RACE_LAPS,
  RACE_MAX_FINISH_GAP,
  raceProgressAt,
} from './track.js';

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

  score += raceLuckRoll() * 2.2;
  score += (Math.random() - 0.5) * stats.temper * 0.9;
  return score;
}

function overallPower(stats: ResolvedStats): number {
  return stats.speed * 0.38 + stats.stamina * 0.34 + stats.accel * 0.28;
}

export function odds(field: RaceBull[]): number[] {
  const bases = field.map((b) => {
    const score = b.isNpc ? npcScore(b) : (b.score ?? npcScore(b));
    return Math.pow(score, 1.35);
  });
  const sum = bases.reduce((a, c) => a + c, 0);
  return field.map((_, i) => Math.min(12, Math.max(1.2, 0.95 / (bases[i] / sum))));
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

  for (let lap = 0; lap < laps; lap++) {
    const spreadFrac = RACE_LAP_SPREAD[Math.min(lap, RACE_LAP_SPREAD.length - 1)];
    const spreadMs = RACE_BASE_LAP_MS * spreadFrac;
    const ranked = statsList
      .map((st, i) => ({ i, s: lapScore(st, lap, laps) }))
      .sort((a, b) => b.s - a.s);

    ranked.forEach((entry, rank) => {
      const jitter = (Math.random() - 0.5) * spreadMs * 0.15;
      const t = RACE_BASE_LAP_MS + (n > 1 ? (rank / (n - 1)) * spreadMs : 0) + jitter;
      lapTimes[entry.i].push(Math.max(RACE_BASE_LAP_MS * 0.92, t));
    });
  }

  // Cap total spread so maxed bull vs starter is at most ~1 lap behind at the flag.
  const totals = lapTimes.map((lt) => lt.reduce((a, c) => a + c, 0));
  const minTotal = Math.min(...totals);
  const maxAllowed = minTotal * (1 + RACE_MAX_FINISH_GAP);
  for (let i = 0; i < n; i++) {
    if (totals[i] > maxAllowed) {
      const scale = maxAllowed / totals[i];
      lapTimes[i] = lapTimes[i].map((t) => t * scale);
      totals[i] = maxAllowed;
    }
  }

  const scored: RaceBull[] = field.map((b, i) => ({
    ...b,
    lapTimes: lapTimes[i],
    finishT: totals[i],
    score: overallPower(statsList[i]) + raceLuckRoll() * 3,
  }));

  scored.sort((a, b) => (a.finishT ?? 0) - (b.finishT ?? 0));
  scored.forEach((b, i) => {
    b.pos = i + 1;
  });

  const endT = Math.max(...totals);
  return { bulls: scored, endT };
}

export function buildRaceResults(
  bulls: RaceBull[],
  myBullIds: number[],
): RaceResult[] {
  const sorted = [...bulls].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  return sorted.map((r) => ({
    name: r.name,
    owner: r.owner || '',
    pos: r.pos ?? 0,
    prize: PURSE[(r.pos ?? 1) - 1] || 0,
    mine: myBullIds.includes(r.id as number),
  }));
}

export function liveStandings(bulls: RaceBull[], elapsed: number): { pos: number; name: string }[] {
  return [...bulls]
    .map((b) => ({
      b,
      p: b.lapTimes?.length
        ? raceProgressAt(elapsed, b.lapTimes)
        : Math.min(1, elapsed / (b.finishT ?? 1)),
    }))
    .sort((a, c) => c.p - a.p)
    .map((x, i) => ({ pos: i + 1, name: x.b.name }));
}

export function pickNpcField(count = 5): NpcBull[] {
  const pool = [...NPC_POOL].sort(() => Math.random() - 0.5);
  return pool.slice(0, count).map((n, i) => ({ ...n, id: `npc${i}`, isNpc: true as const }));
}
