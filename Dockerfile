FROM node:20-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config and lockfile first (cache layer)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY dashboard/package.json dashboard/package.json
COPY widget/package.json widget/package.json

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json tsconfig.server.json drizzle.config.ts ./
COPY server/ server/
COPY dashboard/ dashboard/
COPY widget/ widget/

# Build all
RUN pnpm build

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/dashboard/dist ./dashboard/dist
COPY --from=builder /app/widget/dist ./widget/dist
COPY --from=builder /app/server/db/seed.ts ./server/db/seed.ts

# Create directories for persistent data
RUN mkdir -p data storage/screenshots storage/recordings

VOLUME /app/data
VOLUME /app/storage

EXPOSE 10009

ENV NODE_ENV=production
ENV SCOUT_PORT=10009
ENV SCOUT_DB_PATH=data/scout.db

CMD ["node", "dist/server/index.js"]
