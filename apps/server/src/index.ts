import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
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
const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const normalized = origin.replace(/\/+$/, '');
      if (normalized === CORS_ORIGIN) return cb(null, true);
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
    cors: { origin: CORS_ORIGIN, credentials: true },
  });

  setupSocket(io, app);
  setGameIo(io);
  setRaceIo(io);
  setPastureIo(io);
  startRaceScheduler();
  startGoldMarketSweeper();
  startPastureSpawner();

  console.log(`Bull Run server on :${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
