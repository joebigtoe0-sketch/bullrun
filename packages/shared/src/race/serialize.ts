import type { BullGear, BullTrait, RaceBull } from '../types.js';

/** Wire format — one immutable snapshot per race, shared by grid / start / finish. */
export interface RaceBullWire {
  id: number | string;
  name: string;
  coat: string;
  trait?: BullTrait;
  owner?: string;
  pos: number;
  finishT: number;
  lapTimes: number[];
  /** Starting-grid lane (1…n). Never changes during the race. */
  gridSlot: number;
  gear?: BullGear;
}

export function serializeRaceBulls(bulls: RaceBull[]): RaceBullWire[] {
  return bulls.map((b, i) => ({
    id: b.id,
    name: b.name,
    coat: b.coat,
    trait: b.trait,
    owner: b.owner,
    pos: b.pos ?? i + 1,
    finishT: b.finishT ?? 0,
    lapTimes: b.lapTimes ?? [],
    gridSlot: i + 1,
    gear: b.gear,
  }));
}

export function wireToRaceBulls(wire: RaceBullWire[]): RaceBull[] {
  return wire.map((b) => ({
    id: b.id,
    name: b.name,
    coat: b.coat,
    trait: b.trait,
    speed: 0,
    stamina: 0,
    accel: 0,
    temper: 0,
    pos: b.pos,
    finishT: b.finishT,
    lapTimes: b.lapTimes,
    owner: b.owner,
    gridSlot: b.gridSlot,
    gear: b.gear,
  })) as RaceBull[];
}
