# --- Build stage ---
FROM node:20-alpine AS builder

# Native addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# 1. Copy only dependency manifests (maximizes Docker layer cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY dashboard/package.json dashboard/package.json
COPY widget/package.json widget/package.json

# 2. Install ALL dependencies (dev + prod — needed for build)
RUN pnpm install --frozen-lockfile

# 3. Copy source
COPY tsconfig.json tsconfig.server.json drizzle.config.ts ./
COPY server/ server/
COPY dashboard/ dashboard/
COPY widget/ widget/
COPY demo/ demo/
COPY drizzle/ drizzle/

# 4. Build all (server TS → JS, dashboard Vite, widget Vite)
RUN pnpm build

# 5. Prune dev dependencies — keep only production deps
RUN pnpm prune --prod

# --- Production stage (minimal) ---
FROM node:20-alpine

WORKDIR /app

# Only production node_modules (no devDependencies, no build tools)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Compiled server
COPY --from=builder /app/dist/server ./dist/server

# Built frontend assets
COPY --from=builder /app/dashboard/dist ./dashboard/dist
COPY --from=builder /app/widget/dist ./widget/dist

# Demo stand
COPY --from=builder /app/demo ./demo

# DB migrations
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./

# Directories for data and uploads
RUN mkdir -p data storage/screenshots storage/recordings

VOLUME /app/data
VOLUME /app/storage
EXPOSE 10009

ENV NODE_ENV=production
ENV SCOUT_PORT=10009
ENV SCOUT_DB_PATH=data/scout.db

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:10009/health || exit 1

CMD ["node", "dist/server/index.js"]
