import {
  NPC_POOL,
  RACE_LAPS,
  DEFAULT_RACE_INTERVAL_SEC,
  buildRaceResults,
  liveStandings,
  maxBullLevel,
  pickNpcField,
  racePrizeForPosition,
  simulateRace,
  type RaceBull,
  type BullTrait,
} from '@bullrun/shared';
import type { Server as SocketServer } from 'socket.io';
import type { RaceEntry, Item as PrismaItem } from '@prisma/client';
import { prisma } from '../db.js';
import { completeBreed, tickAllEnergy } from '../services/game.js';

let io: SocketServer | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
const activeRaces = new Map<string, { bulls: RaceBull[]; startT: number; endT: number }>();
const gridEmitted = new Set<string>();
/** Pre-simulated field from grid window — reused at race start so positions match the grid. */
const raceBullsCache = new Map<string, RaceBull[]>();

export function setRaceIo(server: SocketServer) {
  io = server;
}

/** Re-sync a client that connected mid-race. */
export function syncRunningRaceToSocket(raceId: string, socket: { emit: (ev: string, data: unknown) => void }) {
  const active = activeRaces.get(raceId);
  if (!active) return;
  const elapsed = Date.now() - active.startT;
  socket.emit('race_started', {
    id: raceId,
    bulls: active.bulls,
    startT: active.startT,
    endT: active.endT,
    laps: RACE_LAPS,
    elapsed,
  });
  socket.emit('race_standings', {
    id: raceId,
    standings: liveStandings(active.bulls, elapsed),
    elapsed,
  });
}

export async function ensureScheduledRace() {
  const running = await prisma.race.findFirst({ where: { status: { in: ['scheduled', 'running'] } } });
  if (running) return running;

  const intervalSec = Number(process.env.RACE_INTERVAL_SEC || DEFAULT_RACE_INTERVAL_SEC);
  const field = pickNpcField(5);
  return prisma.race.create({
    data: {
      status: 'scheduled',
      startAt: new Date(Date.now() + intervalSec * 1000),
      field: field as object,
    },
  });
}

async function buildRaceField(raceId: string): Promise<RaceBull[]> {
  const entries = await prisma.raceEntry.findMany({
    where: { raceId },
    include: { user: { include: { items: true } } },
  });

  const playerBulls: RaceBull[] = [];
  for (const e of entries) {
    if (e.isNpc || !e.bullId) continue;
    const bull = await prisma.bull.findUnique({ where: { id: e.bullId } });
    if (!bull) continue;
    const user = e.user!;
    playerBulls.push({
      ...bull,
      owner: user.displayName,
      isMine: false,
      userId: user.id,
    } as RaceBull);
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  const npcField = (race?.field as typeof NPC_POOL) || NPC_POOL;
  const npcs = npcField.map((n, i) => ({ ...n, id: `npc${i}`, isNpc: true as const }));

  const allItems = entries.flatMap((e: RaceEntry & { user?: { items: PrismaItem[] } | null }) => e.user?.items ?? []);
  const { bulls } = simulateRace(playerBulls, npcs, allItems.map((it: PrismaItem) => ({
    id: it.id,
    slot: it.slot as 'coat',
    rarity: it.rarity as 'Common',
    rarityColor: it.rarityColor,
    name: it.name,
    color: it.color,
    bonus: it.bonusStat ? { stat: it.bonusStat as 'speed', amt: it.bonusAmt ?? 0 } : null,
    equippedTo: it.equippedTo,
  })));

  return bulls;
}

async function startRace(raceId: string) {
  const row = await prisma.race.findUnique({ where: { id: raceId } });
  if (!row || row.status !== 'scheduled') return;

  const bulls = raceBullsCache.get(raceId) ?? await buildRaceField(raceId);
  raceBullsCache.delete(raceId);
  const now = Date.now();
  const endT = Math.max(...bulls.map((b) => b.finishT ?? 0), 9000);

  await prisma.race.update({
    where: { id: raceId },
    data: { status: 'running', endAt: new Date(now + endT) },
  });

  activeRaces.set(raceId, { bulls, startT: now, endT: now + endT });

  io?.emit('race_started', { id: raceId, bulls, startT: now, endT: now + endT, laps: RACE_LAPS, elapsed: 0 });

  const standingsIv = setInterval(() => {
    const active = activeRaces.get(raceId);
    if (!active) { clearInterval(standingsIv); return; }
    const elapsed = Date.now() - active.startT;
    if (elapsed >= active.endT - active.startT + 2500) {
      clearInterval(standingsIv);
      return;
    }
    io?.emit('race_standings', { id: raceId, standings: liveStandings(active.bulls, elapsed), elapsed });
  }, 250);

  setTimeout(() => finishRace(raceId), endT + 2500);
}

async function finishRace(raceId: string) {
  let active = activeRaces.get(raceId);
  if (!active) {
    const row = await prisma.race.findUnique({ where: { id: raceId } });
    if (!row || row.status !== 'running') return;
    console.warn(`[race] finishRace ${raceId} without in-memory state — rebuilding field`);
    const bulls = raceBullsCache.get(raceId) ?? await buildRaceField(raceId);
    const span = Math.max(...bulls.map((b) => b.finishT ?? 0), 9000);
    const endT = Date.now();
    active = { bulls, startT: endT - span, endT };
  }
  activeRaces.delete(raceId);
  raceBullsCache.delete(raceId);

  const entries = await prisma.raceEntry.findMany({ where: { raceId } });
  const myBullIds = entries.filter((e: RaceEntry) => e.bullId).map((e: RaceEntry) => e.bullId!);
  const results = buildRaceResults(active.bulls, myBullIds);

  for (const rb of active.bulls) {
    const prize = racePrizeForPosition(rb.pos ?? 1, active.bulls.length);
    const entry = entries.find((e: RaceEntry) => e.bullId === rb.id);
    if (entry?.userId && prize > 0) {
      const profile = await prisma.playerProfile.findUnique({ where: { userId: entry.userId } });
      if (profile) {
        await prisma.playerProfile.update({
          where: { userId: entry.userId },
          data: { gold: profile.gold + prize },
        });
      }
      const bull = await prisma.bull.findUnique({ where: { id: rb.id as number } });
      if (bull) {
        const xpGain = rb.pos === 1 ? 60 : Math.max(10, 40 - (rb.pos ?? 1) * 5);
        let xp = bull.xp + xpGain;
        let level = bull.level;
        const maxLv = maxBullLevel((bull.rarity as import('@bullrun/shared').BullRarity) || (bull.trait as BullTrait) || 'common');
        let need = level * 100;
        while (xp >= need && level < maxLv) {
          level++;
          xp -= need;
          need = level * 100;
        }
        await prisma.bull.update({
          where: { id: bull.id },
          data: { xp, level },
        });
      }
    }
  }

  const bets = await prisma.bet.findMany({ where: { raceId } });
  const winner = active.bulls.find((b) => b.pos === 1);
  const betResults: Record<string, string> = {};

  for (const bet of bets) {
    const won = winner && String(winner.id) === bet.targetBullId;
    let payout = 0;
    if (won) {
      payout = Math.round(bet.amount * bet.odds);
      const profile = await prisma.playerProfile.findUnique({ where: { userId: bet.userId } });
      if (profile) {
        await prisma.playerProfile.update({
          where: { userId: bet.userId },
          data: { gold: profile.gold + payout },
        });
      }
      betResults[bet.userId] = `🎉 Your bet hit! ${winner!.name} won — payout ${payout}g`;
    } else {
      betResults[bet.userId] = `Your bet on ${bet.targetName} missed — ${winner?.name} took it. Lost ${bet.amount}g.`;
    }
    await prisma.bet.update({
      where: { id: bet.id },
      data: { won, payout: won ? payout : 0 },
    });
  }

  await prisma.race.update({
    where: { id: raceId },
    data: { status: 'finished', results: results as object },
  });

  io?.emit('race_finished', { id: raceId, results, betResults });

  const intervalSec = Number(process.env.RACE_INTERVAL_SEC || DEFAULT_RACE_INTERVAL_SEC);
  const field = pickNpcField(5);
  const next = await prisma.race.create({
    data: {
      status: 'scheduled',
      startAt: new Date(Date.now() + intervalSec * 1000),
      field: field as object,
    },
  });
  io?.emit('race_scheduled', { id: next.id, startAt: next.startAt.getTime(), field });
}

/** Finish a race that lost in-memory state (e.g. server restarted mid-race). */
async function salvageRunningRace(raceId: string) {
  const row = await prisma.race.findUnique({ where: { id: raceId } });
  if (!row || row.status !== 'running' || activeRaces.has(raceId)) return;

  console.warn(`[race] Salvaging orphaned running race ${raceId}`);
  const bulls = await buildRaceField(raceId);
  const span = Math.max(...bulls.map((b) => b.finishT ?? 0), 9000);
  const endT = Date.now();
  activeRaces.set(raceId, { bulls, startT: endT - span, endT });
  await finishRace(raceId);
}

async function recoverRaceState() {
  const stuck = await prisma.race.findMany({
    where: { status: 'running' },
    orderBy: { startAt: 'asc' },
  });
  for (const race of stuck) {
    if (!activeRaces.has(race.id)) {
      await salvageRunningRace(race.id);
    }
  }

  let overdue = await prisma.race.findFirst({
    where: { status: 'scheduled', startAt: { lte: new Date() } },
    orderBy: { startAt: 'asc' },
  });
  while (overdue) {
    gridEmitted.delete(overdue.id);
    try {
      await startRace(overdue.id);
    } catch (err) {
      console.error('[race] Failed to start overdue race', overdue.id, err);
      await prisma.race.update({
        where: { id: overdue.id },
        data: { status: 'finished', results: [] },
      });
      break;
    }
    overdue = await prisma.race.findFirst({
      where: { status: 'scheduled', startAt: { lte: new Date() } },
      orderBy: { startAt: 'asc' },
    });
  }

  return ensureScheduledRace();
}

async function schedulerTick() {
  const now = Date.now();

  const orphaned = await prisma.race.findMany({ where: { status: 'running' } });
  for (const race of orphaned) {
    if (!activeRaces.has(race.id)) {
      const endMs = race.endAt?.getTime() ?? 0;
      if (endMs > 0 && endMs < now) {
        await salvageRunningRace(race.id);
      }
    }
  }

  const gridWindow = await prisma.race.findFirst({
    where: {
      status: 'scheduled',
      startAt: { lte: new Date(now + 10_000), gt: new Date(now) },
    },
    orderBy: { startAt: 'asc' },
  });
  if (gridWindow && !gridEmitted.has(gridWindow.id)) {
    gridEmitted.add(gridWindow.id);
    const bulls = await buildRaceField(gridWindow.id);
    raceBullsCache.set(gridWindow.id, bulls);
    io?.emit('race_grid', {
      id: gridWindow.id,
      bulls,
      startAt: gridWindow.startAt.getTime(),
      laps: RACE_LAPS,
    });
  }

  const due = await prisma.race.findFirst({
    where: { status: 'scheduled', startAt: { lte: new Date() } },
    orderBy: { startAt: 'asc' },
  });
  if (due) {
    gridEmitted.delete(due.id);
    try {
      await startRace(due.id);
    } catch (err) {
      console.error('[race] startRace failed for', due.id, err);
      const staleMs = now - due.startAt.getTime();
      if (staleMs > 120_000) {
        console.warn(`[race] Abandoning stale scheduled race ${due.id} (${Math.round(staleMs / 1000)}s overdue)`);
        await prisma.race.update({
          where: { id: due.id },
          data: { status: 'finished', results: [] },
        });
        await ensureScheduledRace();
      }
    }
  }

  const nodes = await prisma.worldNode.findMany({
    where: { deadUntil: { lte: new Date() } },
  });
  for (const n of nodes) {
    await prisma.worldNode.update({ where: { id: n.id }, data: { deadUntil: null } });
    io?.emit('node_respawned', { id: n.id });
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) await completeBreed(u.id);
}

export function startRaceScheduler() {
  void recoverRaceState().then((race) => {
    io?.emit('race_scheduled', { id: race.id, startAt: race.startAt.getTime(), field: race.field });
  });

  schedulerTimer = setInterval(() => {
    void schedulerTick().catch((err) => console.error('[race] scheduler tick error', err));
  }, 1000);

  setInterval(() => {
    void tickAllEnergy().catch((err) => console.error('Energy tick error', err));
  }, 60_000);
}

export function stopRaceScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
}
