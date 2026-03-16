FROM node:20-alpine AS builder

# Build tools for native addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY dashboard/package.json dashboard/package.json
COPY widget/package.json widget/package.json

# Install dependencies, approve native builds
RUN pnpm install --frozen-lockfile
RUN npx --yes node-gyp rebuild --directory node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3

# Copy source
COPY tsconfig.json tsconfig.server.json drizzle.config.ts ./
COPY server/ server/
COPY dashboard/ dashboard/
COPY widget/ widget/
COPY demo/ demo/

# Build all
RUN pnpm build

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/dashboard/dist ./dashboard/dist
COPY --from=builder /app/widget/dist ./widget/dist
COPY --from=builder /app/demo ./demo
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/server/db/seed.ts ./server/db/seed.ts

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
