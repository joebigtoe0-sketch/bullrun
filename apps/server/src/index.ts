import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Server as SocketServer } from 'socket.io';
import { registerAuth } from './auth.js';
import { authRoutes, gameRoutes } from './routes/index.js';
import { setupSocket } from './socket/index.js';
import { initWorldNodes } from './services/player.js';
import { setIo as setGameIo } from './services/game.js';
import { setRaceIo, startRaceScheduler } from './race/scheduler.js';

const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: CORS_ORIGIN, credentials: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });
  registerAuth(app);

  app.get('/health', async () => ({ ok: true, online: 0 }));

  await authRoutes(app);
  await gameRoutes(app);

  await initWorldNodes();

  await app.listen({ port: PORT, host: '0.0.0.0' });

  const io = new SocketServer(app.server, {
    cors: { origin: CORS_ORIGIN, credentials: true },
  });

  setupSocket(io, app);
  setGameIo(io);
  setRaceIo(io);
  startRaceScheduler();

  console.log(`Bull Run server on :${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
