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

# Build server
RUN pnpm --filter @bullrun/server build

# Expose port
EXPOSE 3001

# Start server
CMD ["sh", "-c", "pnpm db:deploy && node apps/server/dist/index.js"]

