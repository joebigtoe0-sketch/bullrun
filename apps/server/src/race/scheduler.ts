import {
  NPC_POOL,
  PURSE,
  buildRaceResults,
  liveStandings,
  pickNpcField,
  simulateRace,
  type RaceBull,
} from '@bullrun/shared';
import type { Server as SocketServer } from 'socket.io';
import type { RaceEntry, Item as PrismaItem } from '@prisma/client';
import { prisma } from '../db.js';
import { completeBreed } from '../services/game.js';

let io: SocketServer | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
const activeRaces = new Map<string, { bulls: RaceBull[]; startT: number; endT: number }>();

export function setRaceIo(server: SocketServer) {
  io = server;
}

export async function ensureScheduledRace() {
  const running = await prisma.race.findFirst({ where: { status: { in: ['scheduled', 'running'] } } });
  if (running) return running;

  const intervalSec = Number(process.env.RACE_INTERVAL_SEC || 120);
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
  const bulls = await buildRaceField(raceId);
  const now = Date.now();
  const endT = bulls[bulls.length - 1]?.finishT ?? 9000;

  await prisma.race.update({
    where: { id: raceId },
    data: { status: 'running', endAt: new Date(now + endT) },
  });

  activeRaces.set(raceId, { bulls, startT: now, endT: now + endT });

  io?.emit('race_started', { id: raceId, bulls, startT: now, endT: now + endT });

  const standingsIv = setInterval(() => {
    const active = activeRaces.get(raceId);
    if (!active) { clearInterval(standingsIv); return; }
    const elapsed = Date.now() - active.startT;
    if (elapsed >= active.endT - active.startT + 700) {
      clearInterval(standingsIv);
      return;
    }
    io?.emit('race_standings', { id: raceId, standings: liveStandings(active.bulls, elapsed) });
  }, 250);

  setTimeout(() => finishRace(raceId), endT + 700);
}

async function finishRace(raceId: string) {
  const active = activeRaces.get(raceId);
  if (!active) return;
  activeRaces.delete(raceId);

  const entries = await prisma.raceEntry.findMany({ where: { raceId } });
  const myBullIds = entries.filter((e: RaceEntry) => e.bullId).map((e: RaceEntry) => e.bullId!);
  const results = buildRaceResults(active.bulls, myBullIds);

  for (const rb of active.bulls) {
    const prize = PURSE[(rb.pos ?? 1) - 1] || 0;
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
        const need = level * 100;
        if (xp >= need) { level++; xp -= need; }
        await prisma.bull.update({
          where: { id: bull.id },
          data: { xp, level, energy: Math.max(0, bull.energy - 10) },
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

  const intervalSec = Number(process.env.RACE_INTERVAL_SEC || 120);
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

export function startRaceScheduler() {
  void ensureScheduledRace().then((race) => {
    io?.emit('race_scheduled', { id: race.id, startAt: race.startAt.getTime(), field: race.field });
  });

  schedulerTimer = setInterval(async () => {
    const due = await prisma.race.findFirst({
      where: { status: 'scheduled', startAt: { lte: new Date() } },
      orderBy: { startAt: 'asc' },
    });
    if (due) await startRace(due.id);

    const nodes = await prisma.worldNode.findMany({
      where: { deadUntil: { lte: new Date() } },
    });
    for (const n of nodes) {
      await prisma.worldNode.update({ where: { id: n.id }, data: { deadUntil: null } });
      io?.emit('node_respawned', { id: n.id });
    }

    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) await completeBreed(u.id);
  }, 1000);
}

export function stopRaceScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
}
