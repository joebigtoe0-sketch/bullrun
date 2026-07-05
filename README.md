# Bull Run

Multiplayer bull-racing MMO — voxel isometric world built with React Three Fiber, Fastify, Socket.io, and PostgreSQL.

## Local development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for local Postgres)

### Setup

```bash
# Start Postgres
docker compose up -d

# Copy env
cp .env.example .env

# Install dependencies
pnpm install

# Build shared package
pnpm --filter @bullrun/shared build

# Push database schema
pnpm db:push

# Run client + server
pnpm dev
```

- **Client:** http://localhost:5173
- **Server:** http://localhost:3001

Create an account in-game to start playing.

## Project structure

```
bullrun/
├── apps/client/     # Vite + React + Three.js (R3F)
├── apps/server/     # Fastify + Socket.io + Prisma
├── packages/shared/ # Game logic, world gen, race math
└── Bull Run game design spec/  # Original prototype (reference)
```

## Deploy to Railway

Create a Railway project with **3 services**:

### 1. PostgreSQL

Add the PostgreSQL plugin. Railway sets `DATABASE_URL` automatically.

### 2. Server (`apps/server`)

| Setting | Value |
|---------|-------|
| Root directory | `apps/server` |
| Build | `cd ../.. && pnpm install && pnpm --filter @bullrun/shared build && pnpm --filter @bullrun/server build` |
| Start | `pnpm db:deploy && node dist/index.js` |

**Environment variables:**
- `DATABASE_URL` — from Postgres plugin
- `JWT_SECRET` — random secret string
- `CORS_ORIGIN` — your client Railway URL (e.g. `https://bullrun-client.up.railway.app`)
- `RACE_INTERVAL_SEC` — `120`
- `PORT` — Railway sets this automatically

### 3. Client (`apps/client`)

| Setting | Value |
|---------|-------|
| Root directory | `apps/client` |
| Build | `cd ../.. && pnpm install && pnpm --filter @bullrun/shared build && pnpm --filter @bullrun/client build` |
| Start | `pnpm preview` |

**Environment variables:**
- `VITE_API_URL` — server public URL
- `VITE_WS_URL` — server public URL (same as API)
- `PORT` — Railway sets this

> **Note:** Set `VITE_*` vars before build — Vite bakes them in at build time.

## Game features

- Register/login with cloud saves
- Shared voxel isometric world (Three.js)
- See other players move in real time (WebSockets)
- Synchronized resource gathering nodes
- Global scheduled races with betting
- Player market for materials
- Stable management, breeding, forging, training

## Push to GitHub

```bash
git init
git add .
git commit -m "Bull Run MMO — full stack game"
git remote add origin https://github.com/YOUR_USER/bullrun.git
git push -u origin main
```

Connect the GitHub repo to Railway for automatic deploys.
