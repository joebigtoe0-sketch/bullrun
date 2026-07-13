import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Server as SocketServer } from 'socket.io';
import { registerAuth } from './auth.js';
import { authRoutes, gameRoutes } from './routes/index.js';
import { setupSocket } from './socket/index.js';
import { initWorldNodes } from './services/player.js';
import { initPasturePlots, setPastureIo, startPastureSpawner } from './services/pasture.js';
import { prisma } from './db.js';
import { setIo as setGameIo } from './services/game.js';
import { setRaceIo, startRaceScheduler } from './race/scheduler.js';
import { startGoldMarketSweeper } from './routes/tokenMarket.js';
import { grantFromEnvIfSet } from './lib/grantResources.js';
import { getOnlineCount } from './socket/index.js';

const PORT = Number(process.env.PORT || 3001);

function parseCorsOrigins(raw: string | undefined): string[] {
  const fallback = 'http://localhost:5173';
  const list = (raw || fallback)
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length ? list : [fallback];
}

const CORS_ORIGINS = parseCorsOrigins(process.env.CORS_ORIGIN);

/**
 * Push the Prisma schema to the database at boot. Runs regardless of the
 * platform start command, so new tables/columns always exist even if the
 * deploy's start command doesn't run migrations. Idempotent (no-op when in
 * sync); never drops data (no --accept-data-loss).
 */
function syncDatabaseSchema() {
  const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    console.log('[db] syncing schema (prisma db push)…');
    execSync('npx prisma db push --skip-generate', {
      cwd: serverRoot,
      stdio: 'inherit',
      env: process.env,
    });
    console.log('[db] schema in sync');
  } catch (err) {
    console.error('[db] schema sync failed (continuing):', err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log(`CORS allowed origins: ${CORS_ORIGINS.join(', ')}`);
  syncDatabaseSchema();
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      const normalized = origin.replace(/\/+$/, '');
      if (CORS_ORIGINS.includes(normalized)) {
        cb(null, normalized);
        return;
      }
      cb(null, false);
    },
    credentials: true,
  });
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });
  registerAuth(app);

  app.get('/health', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: true };
    } catch {
      return { ok: false, db: false, hint: 'DATABASE_URL is wrong — reference Postgres from the server service' };
    }
  });

  app.get('/online', async () => ({ online: getOnlineCount() }));

  await authRoutes(app);
  await gameRoutes(app);

  await initWorldNodes();
  await initPasturePlots();
  await grantFromEnvIfSet();

  await app.listen({ port: PORT, host: '0.0.0.0' });

  const io = new SocketServer(app.server, {
    cors: { origin: CORS_ORIGINS, credentials: true },
  });

  setupSocket(io, app);
  setGameIo(io);
  setRaceIo(io);
  setPastureIo(io);
  startRaceScheduler();
  startGoldMarketSweeper();
  startPastureSpawner();

  console.log(`Bull Race server on :${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
