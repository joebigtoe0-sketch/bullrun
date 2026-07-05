FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy everything
COPY . .

# Install dependencies with pnpm
RUN pnpm install --frozen-lockfile

# Build shared package
RUN pnpm --filter @bullrun/shared build

# Prisma client must exist before tsc (strict mode needs generated types)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter @bullrun/server db:generate

# Build server
RUN pnpm --filter @bullrun/server build

# Expose port
EXPOSE 3001

# Start server
CMD ["sh", "-c", "pnpm db:deploy && node apps/server/dist/index.js"]

