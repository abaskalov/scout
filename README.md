<p align="center">
  <img src="https://img.icons8.com/fluency/96/bug.png" alt="Scout" width="80" />
</p>

<h1 align="center">Scout</h1>

<p align="center">
  <strong>Autonomous bug tracking with AI agent</strong><br/>
  Embeddable widget &middot; AI-powered fixes &middot; Multi-language dashboard
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> &middot;
  <a href="#widget">Widget</a> &middot;
  <a href="#dashboard">Dashboard</a> &middot;
  <a href="#ai-orchestrator">AI Orchestrator</a> &middot;
  <a href="#deployment">Deployment</a> &middot;
  <a href="#api">API</a>
</p>

---

## What is Scout?

Self-hosted bug tracker for AI-first teams. Testers report bugs via an embeddable widget that captures element context, screenshots, and session recordings. AI agent picks up bugs, creates fixes, opens PRs.

```
Tester clicks element  →  Widget captures context + screenshot + recording
                                ↓
                        API creates item (new)
                                ↓
                        AI claims → fixes → opens PR (review)
                                ↓
                        Admin merges PR → done
```

## Features

| Area | Details |
|------|---------|
| **Widget** | Shadow DOM isolation, element picker with instruction banner, html2canvas-pro screenshot with element highlight, rrweb session recording (60s buffer), cross-domain SSO |
| **Dashboard** | React SPA, rrweb session player, items/projects/users/webhooks management, locale switcher |
| **i18n** | Russian, English, Uzbek (Latin). Dashboard + widget. Server error codes translated on client |
| **AI Orchestrator** | Claims bugs, runs opencode, validates, creates PRs, updates status |
| **Auth** | JWT + API keys (`sk_live_*`), role-based access (admin/member/agent), cross-domain SSO (cookie + iframe + popup) |
| **Infra** | Single process (API + SPA + widget on one port), SQLite, Docker, publishable GHCR image |

## Quickstart

### Docker

```bash
docker run -d \
  --name scout \
  -p 10009:10009 \
  -e SCOUT_JWT_SECRET=$(openssl rand -hex 32) \
  -v scout-data:/app/data \
  -v scout-storage:/app/storage \
  ghcr.io/<your-org>/scout:master
```

Open http://localhost:10009 — login `admin@scout.local` / `admin`.

Auto-creates admin, AI agent, and demo project on first start. **Change passwords immediately.**

### From source

```bash
git clone https://github.com/<your-org>/scout.git && cd scout
pnpm install
pnpm db:seed     # create DB with test data
pnpm dev:all     # API + dashboard + widget (hot reload)
```

## Widget

```html
<script>
  window.__SCOUT_CONFIG__ = {
    apiUrl: 'https://your-scout.com',
    projectSlug: 'my-project',
  };
</script>
<script src="https://your-scout.com/widget/scout-widget.js" async></script>
```

**What it captures:** CSS selector, element text/HTML, page URL, viewport size, browser/OS metadata, screenshot (with element highlight), session recording (last 60 seconds).

**SSO:** Users log in once — session shared across all sites via cookie (subdomains) or popup (cross-domain).

**Language:** Auto-detected from `navigator.language`. Supports `ru`, `en`, `uz`.

**Config options:**

| Option | Default | Description |
|--------|---------|-------------|
| `apiUrl` | — | Scout server URL (required) |
| `projectSlug` | — | Project slug (required) |
| `enabled` | `true` | Set `false` to hide. `?scout=1` in URL overrides |

## Dashboard

Responsive React SPA served from the same port as the API.

- **Items** — List with status/priority filters, search, pagination. Detail view with screenshot lightbox, rrweb session player, notes timeline, resolve modal
- **Projects** — CRUD with allowed origins for CORS/SSO, auto-fix toggle
- **Users** — CRUD with role assignment, project access control
- **Webhooks** — Per-project event notifications (Slack-compatible)
- **Language** — Switcher in sidebar (RU / EN / UZ)

## AI Orchestrator

```bash
pnpm orchestrator
```

Claims `new` bugs → parses recording → creates branch → runs `opencode` → validates (typecheck + lint, up to 3 retries) → commits → opens PR → sets status to `review`.

Configure project-to-repo mapping in `orchestrator/config.ts`. Requires `opencode` and `gh` CLI.

## API

All endpoints are `POST` with JSON body. Auth via `Authorization: Bearer <jwt|api-key>`.

Base path: `/api/v1/` (or `/api/` for backward compatibility).

Interactive docs: `https://your-scout.example/api/docs`

**Key endpoints:**

| Endpoint | Description |
|----------|-------------|
| `/api/auth/login` | Get JWT token |
| `/api/items/create` | Create bug report |
| `/api/items/list` | List items (filtered) |
| `/api/items/get` | Get item with notes |
| `/api/items/claim` | Assign to self |
| `/api/items/resolve` | Mark as done |
| `/api/auth/validate` | Validate token/API key |

## Deployment

### Docker Compose with HTTPS

Generic, non-production examples are available in `deploy/`. Keep real production compose files, `.env`, hostnames, SSH aliases, and server paths local and untracked.

```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data

  scout:
    image: ghcr.io/<your-org>/scout:master
    environment:
      - SCOUT_JWT_SECRET=${SCOUT_JWT_SECRET}
    volumes:
      - scout-data:/app/data
      - scout-storage:/app/storage

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

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCOUT_JWT_SECRET` | dev secret | **Required in production** |
| `SCOUT_PORT` | `10009` | Server port |
| `SCOUT_DB_PATH` | `data/scout.db` | SQLite database path |
| `SCOUT_CORS_ORIGINS` | — | Comma-separated allowed origins |
| `SMTP_HOST` | — | SMTP server for email notifications |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | — | Sender email address |
| `LOG_LEVEL` | `info` | Pino log level |

### CI/CD

Push to `dev` → typecheck + tests.

Push to `master` → typecheck + tests → Docker build + publish to GHCR.

This repository intentionally does not contain production deploy automation. Deploying the published image to a server is owned by the operator of that server.

### Backup

```bash
docker cp scout:/app/data/scout.db ./backup/scout-$(date +%Y%m%d).db
```

## Development

```bash
pnpm dev          # API server (port 10009)
pnpm dev:all      # API + dashboard + widget (hot reload)
pnpm test         # unit tests (Vitest)
pnpm test:e2e     # E2E tests (Playwright — chromium/firefox/webkit)
pnpm typecheck    # TypeScript check
pnpm build        # production build
pnpm db:seed      # seed database with test data
pnpm db:generate  # generate DB migration after schema change
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | Hono, Drizzle ORM, better-sqlite3, Zod |
| Dashboard | React 19, Tailwind CSS 4, Vite 6 |
| Widget | Vanilla TS, html2canvas-pro, rrweb, fflate |
| Auth | JWT, bcrypt, API keys |
| Tests | Vitest (unit), Playwright (E2E) |
| Deploy | Docker, GHCR, Caddy |

## License

MIT
