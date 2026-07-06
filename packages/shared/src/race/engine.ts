import type { Bull, GameItem, NpcBull, RaceBull, RaceResult } from '../types.js';
import { eff, coatOf } from '../helpers.js';
import { NPC_POOL, PURSE } from '../constants.js';
import { RACE_DURATION_SCALE, RACE_LAPS } from './track.js';

export function raceScore(bull: Bull, items: GameItem[]): number {
  return eff(bull, 'speed', items) * 1.0 + eff(bull, 'stamina', items) * 0.8 + eff(bull, 'accel', items) * 0.6;
}

export function npcScore(bull: { speed: number; stamina: number; accel: number }): number {
  const s = bull.speed < 50 ? bull.speed * 10 : bull.speed;
  const st = bull.stamina < 50 ? bull.stamina * 10 : bull.stamina;
  const a = bull.accel < 50 ? bull.accel * 10 : bull.accel;
  return s * 0.12 + st * 0.1 + a * 0.08;
}

function raceLuckRoll(): number {
  return ((Math.random() + Math.random() + Math.random()) / 3) * 50 - 25;
}

export function odds(field: RaceBull[]): number[] {
  const bases = field.map((b) => {
    const score = b.isNpc ? npcScore(b) : (b.score ?? npcScore(b));
    return Math.pow(score, 2);
  });
  const sum = bases.reduce((a, c) => a + c, 0);
  return field.map((_, i) => Math.min(12, Math.max(1.2, 0.95 / (bases[i] / sum))));
}

export function simulateRace(
  playerBulls: RaceBull[],
  npcField: NpcBull[],
  items: GameItem[] = []
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
  const scored: RaceBull[] = field.map((b) => ({
    ...b,
    score:
      npcScore(b) +
      raceLuckRoll() * 1.4 +
      (Math.random() * 2 - 1) * b.temper * 3,
  }));
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const base = 9000;
  scored.forEach((b, i) => {
    b.pos = i + 1;
    const lapTime = base + i * (500 + Math.random() * 600);
    b.finishT = lapTime * RACE_LAPS * RACE_DURATION_SCALE;
  });
  const endT = scored[scored.length - 1].finishT ?? base;
  return { bulls: scored, endT };
}

export function buildRaceResults(
  bulls: RaceBull[],
  myBullIds: number[]
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
    .map((b) => ({ b, p: Math.min(1, elapsed / (b.finishT ?? 1)) }))
    .sort((a, c) => c.p - a.p)
    .map((x, i) => ({ pos: i + 1, name: x.b.name }));
}

export function pickNpcField(count = 5): NpcBull[] {
  const pool = [...NPC_POOL].sort(() => Math.random() - 0.5);
  return pool.slice(0, count).map((n, i) => ({ ...n, id: `npc${i}`, isNpc: true as const }));
}
