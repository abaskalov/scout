<p align="center">
  <img src="https://img.icons8.com/fluency/96/bug.png" alt="Scout" width="80" />
</p>

<h1 align="center">Scout</h1>

<p align="center">
  <strong>Autonomous bug tracking with AI agent</strong><br/>
  Embeddable widget + Dashboard + AI Orchestrator in one self-hosted process
</p>

<p align="center">
  <a href="https://github.com/abaskalov/scout/actions/workflows/ci.yml"><img src="https://github.com/abaskalov/scout/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/abaskalov/scout/actions/workflows/docker.yml"><img src="https://github.com/abaskalov/scout/actions/workflows/docker.yml/badge.svg" alt="Docker" /></a>
  <a href="https://github.com/abaskalov/scout/pkgs/container/scout"><img src="https://img.shields.io/badge/ghcr.io-scout-blue?logo=docker" alt="Docker Image" /></a>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#widget-integration">Widget</a> &middot;
  <a href="#api">API</a> &middot;
  <a href="#ai-orchestrator">AI Orchestrator</a> &middot;
  <a href="#deployment">Deployment</a>
</p>

---

## What is Scout?

Scout is a self-hosted bug tracking system designed for AI-first teams. Testers report bugs through an embeddable widget that captures element context, screenshots, and session recordings. An AI agent automatically picks up new bugs, creates fixes, and opens pull requests.

**How it works:**

```
Tester clicks element on site  →  Widget captures context + screenshot + rrweb recording
                                       ↓
                              Scout API creates item (status: new)
                                       ↓
                              AI Orchestrator claims item → runs opencode → creates PR
                                       ↓
                              Admin reviews PR in dashboard → merges → done
```

## Features

- **Embeddable Widget** — Vanilla TS, Shadow DOM isolation, works on any site. Element picker, html2canvas screenshots, rrweb session recording (30s rolling buffer)
- **Dashboard** — React SPA with responsive mobile layout. Items list, detail with rrweb player, Projects/Users CRUD
- **21 POST API endpoints** — Auth, Items (create/list/get/count/claim/resolve/cancel/update-status/add-note), Projects CRUD, Users CRUD
- **AI Orchestrator** — Claims new bugs, runs opencode to fix, validates (typecheck + lint), creates branches and PRs via `gh` CLI
- **Status workflow** — `new` → `in_progress` → `review` → `done` with validated transitions and auto-generated notes
- **Roles** — `admin` (full access), `member` (report bugs), `agent` (claim, fix, resolve)
- **Single process** — Hono serves API + dashboard + widget on one port (Uptime Kuma pattern)
- **Mobile responsive** — Bottom nav, card layouts, CapacitorJS safe area support
- **Widget visibility control** — `enabled` config flag + `?scout=1` URL override

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | [Hono](https://hono.dev) + [Drizzle ORM](https://orm.drizzle.team) + SQLite |
| Dashboard | React 19 + Vite + Tailwind CSS v4 |
| Widget | Vanilla TypeScript + Shadow DOM (IIFE bundle) |
| Recording | [rrweb](https://www.rrweb.io) (capture) + rrweb-player (playback) |
| Screenshots | [html2canvas](https://html2canvas.hertzen.com) |
| Validation | [Zod](https://zod.dev) |
| Tests | [Vitest](https://vitest.dev) (24 tests) |
| Package Manager | pnpm (workspaces) |

## Quickstart

### Docker (recommended)

```bash
docker run -d \
  --name scout \
  -p 10009:10009 \
  -e SCOUT_JWT_SECRET=$(openssl rand -hex 32) \
  -v scout-data:/app/data \
  -v scout-storage:/app/storage \
  ghcr.io/abaskalov/scout:main
```

Open http://localhost:10009 — login with `admin@scout.local` / `admin`.

### Docker Compose

```yaml
services:
  scout:
    image: ghcr.io/abaskalov/scout:main
    ports:
      - "10009:10009"
    environment:
      - SCOUT_JWT_SECRET=change-me-to-random-secret
    volumes:
      - scout-data:/app/data
      - scout-storage:/app/storage
    restart: unless-stopped

volumes:
  scout-data:
  scout-storage:
```

### From source

```bash
git clone https://github.com/abaskalov/scout.git
cd scout
pnpm install
pnpm db:push
pnpm db:seed        # creates admin + agent + demo project
pnpm dev:all        # starts API + dashboard + widget in dev mode
```

Open http://localhost:10009 (API) or http://localhost:5173 (dashboard dev server).

## Widget Integration

Add two lines to any website:

```html
<script>
  window.__SCOUT_CONFIG__ = {
    apiUrl: 'https://your-scout-instance.com',
    projectSlug: 'your-project',
    // enabled: false,   // set to false to hide widget
  };
</script>
<script src="https://your-scout-instance.com/widget/scout-widget.js" async></script>
```

**Visibility control:**

| Method | Use case |
|--------|----------|
| Don't load `<script>` | Production: zero traffic, controlled by build-time env var |
| `enabled: false` | Script loaded but widget hidden. Toggle by user role, env, etc. |
| `?scout=1` in URL | Override: force show widget even if disabled. For quick testing |

**What gets captured on bug report:**
- CSS selector of clicked element
- Element text + HTML
- Page URL + viewport dimensions
- Screenshot (html2canvas)
- Session recording (last 30 seconds, rrweb)

## API

All endpoints are `POST`, accept JSON body, require `Authorization: Bearer <token>` (except login).

| Group | Endpoints |
|-------|-----------|
| Auth | `login`, `me` |
| Items | `create`, `list`, `get`, `count`, `claim`, `resolve`, `cancel`, `update-status`, `add-note` |
| Projects | `create`, `list`, `get`, `update`, `delete` |
| Users | `create`, `list`, `get`, `update`, `delete` |
| Health | `GET /health` |

**Example:**

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:10009/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@scout.local","password":"admin"}' | jq -r .data.token)

# List items
curl -s -X POST http://localhost:10009/api/items/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"projectId":"<project-uuid>"}'
```

## AI Orchestrator

The orchestrator script automatically fixes bugs reported through the widget.

```bash
pnpm orchestrator
```

**Workflow per item:**

1. Claim item (`new` → `in_progress`)
2. Get full context (message, selector, HTML, screenshot, recording)
3. Parse rrweb recording → text reproduction steps
4. Create branch `fix/scout-{id}`
5. Run `opencode` with bug context
6. Validate: typecheck + lint (retry up to 3 times)
7. Commit + push + `gh pr create`
8. Update item → `review` with PR link

**Configuration:** edit `orchestrator/config.ts` to map Scout projects to git repositories.

**Requirements:** `opencode` CLI, `gh` CLI, access to target git repository.

## Status Workflow

```
new ──→ in_progress ──→ review ──→ done
 │           │            │
 │           │            └──→ in_progress (PR rejected)
 └──→ cancelled    └──→ cancelled / done
```

| Transition | Who | When |
|-----------|-----|------|
| new → in_progress | agent, admin | Claim: took the bug |
| in_progress → review | agent, admin | PR created |
| review → done | admin | PR merged |
| review → in_progress | admin | PR rejected, rework |
| * → cancelled | admin | Not a bug / won't fix |

## Project Structure

```
server/          — Hono API (port 10009)
  db/            — Drizzle schema, SQLite client, seed
  routes/        — auth, items, projects, users
  services/      — items (transitions, auto-notes, file save), auth (JWT, bcrypt)
  middleware/    — auth (JWT verify), permissions (role check)
  lib/           — Zod schemas, error classes
dashboard/       — React SPA (pnpm workspace)
widget/          — IIFE bundle (pnpm workspace)
orchestrator/    — AI agent: scout-client, recording parser, process-bugs
demo/            — Demo page for widget testing
test/            — Vitest tests (24 tests)
```

## Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API server (tsx watch) |
| `pnpm dev:all` | Start API + dashboard + widget (concurrently) |
| `pnpm build` | Build all (server + dashboard + widget) |
| `pnpm start` | Production start |
| `pnpm test` | Run tests |
| `pnpm typecheck` | TypeScript check |
| `pnpm db:push` | Push schema to SQLite |
| `pnpm db:seed` | Seed admin + agent + project |

## Deployment

### With reverse proxy (HTTPS)

```yaml
# docker-compose.yml
services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    restart: unless-stopped

  scout:
    image: ghcr.io/abaskalov/scout:main
    environment:
      - SCOUT_JWT_SECRET=${SCOUT_JWT_SECRET}
    volumes:
      - scout-data:/app/data
      - scout-storage:/app/storage
    restart: unless-stopped

volumes:
  caddy_data:
  scout-data:
  scout-storage:
```

```
# Caddyfile
scout.example.com {
    reverse_proxy scout:10009
}
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCOUT_PORT` | `10009` | Server port |
| `SCOUT_JWT_SECRET` | `dev-secret-...` | JWT signing secret. **Change in production** |
| `SCOUT_DB_PATH` | `data/scout.db` | SQLite database path |
| `NODE_ENV` | — | Set to `production` for production |

### Backup

SQLite = one file. Backup is trivial:

```bash
# From Docker
docker cp scout:/app/data/scout.db ./backup/scout-$(date +%Y%m%d).db
```

### CI/CD

Push to `main` triggers:
1. **CI** — typecheck + tests + build
2. **Docker** — build image + push to `ghcr.io`

Update production:
```bash
docker compose pull scout && docker compose up -d scout
```

## Seed Accounts

On first start, Scout auto-creates:

| Email | Password | Role |
|-------|----------|------|
| `admin@scout.local` | `admin` | admin |
| `agent@scout.local` | `agent` | agent |

And a demo project "My App" with slug `my-app`.

**Change passwords after first login.**

## License

MIT
