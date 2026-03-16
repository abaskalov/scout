<p align="center">
  <img src="https://img.icons8.com/fluency/96/bug.png" alt="Scout" width="80" />
</p>

<h1 align="center">Scout</h1>

<p align="center">
  <strong>Autonomous bug tracking with AI agent</strong><br/>
  Embeddable widget captures context, AI fixes bugs, dashboard manages workflow
</p>

<p align="center">
  <a href="https://github.com/abaskalov/scout/actions/workflows/ci.yml"><img src="https://github.com/abaskalov/scout/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/abaskalov/scout/actions/workflows/docker.yml"><img src="https://github.com/abaskalov/scout/actions/workflows/docker.yml/badge.svg" alt="Docker" /></a>
  <a href="https://github.com/abaskalov/scout/pkgs/container/scout"><img src="https://img.shields.io/badge/ghcr.io-scout-blue?logo=docker" alt="Docker Image" /></a>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> &middot;
  <a href="#widget">Widget</a> &middot;
  <a href="#ai-orchestrator">AI Orchestrator</a> &middot;
  <a href="#deployment">Deployment</a>
</p>

---

## What is Scout?

Self-hosted bug tracker for AI-first teams. Testers report bugs via embeddable widget that captures element context, screenshots, and session recordings. AI agent picks up bugs, creates fixes, opens PRs. Admin reviews in dashboard.

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

- **Widget** — Shadow DOM isolation, element picker, screenshot with element highlight, rrweb recording (30s buffer). Works on any site
- **Dashboard** — Responsive React SPA. Items with rrweb player, Projects/Users management
- **AI Orchestrator** — Claims bugs, runs opencode, validates, creates PRs
- **Status workflow** — `new` → `in_progress` → `review` → `done` with validated transitions
- **Roles** — admin, member (report bugs), agent (fix bugs)
- **Single process** — API + dashboard + widget on one port
- **Mobile** — Bottom nav, card layouts, CapacitorJS safe areas
- **Auto-deploy** — Push to main → CI → Docker → deploy to production

## Quickstart

### Docker

```bash
docker run -d \
  --name scout \
  -p 10009:10009 \
  -e SCOUT_JWT_SECRET=$(openssl rand -hex 32) \
  -v scout-data:/app/data \
  -v scout-storage:/app/storage \
  ghcr.io/abaskalov/scout:main
```

Open http://localhost:10009 — login `admin@scout.local` / `admin`.

On first start, Scout auto-creates admin, AI agent, and a demo project. **Change passwords after first login.**

### From source

```bash
git clone https://github.com/abaskalov/scout.git && cd scout
pnpm install && pnpm dev:all
```

## Widget

Add to any site:

```html
<script>
  window.__SCOUT_CONFIG__ = {
    apiUrl: 'https://your-scout-instance.com',
    projectSlug: 'your-project',
    // enabled: false,   // hide widget; ?scout=1 in URL overrides
  };
</script>
<script src="https://your-scout-instance.com/widget/scout-widget.js" async></script>
```

**Captures:** CSS selector, element text/HTML, page URL, viewport, screenshot (with element highlight), session recording (last 30 seconds).

**Visibility:** `enabled: false` in config hides widget. `?scout=1` in URL forces it to show. Or don't load the script at all.

## AI Orchestrator

```bash
pnpm orchestrator
```

Claims new bugs → parses recording → creates branch → runs `opencode` → validates (typecheck + lint, up to 3 retries) → commits → opens PR → updates status to review.

Configure project-to-repo mapping in `orchestrator/config.ts`. Requires `opencode` and `gh` CLI.

## Deployment

### With HTTPS (Caddy)

```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data

  scout:
    image: ghcr.io/abaskalov/scout:main
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

### Environment

| Variable | Default | Required |
|----------|---------|----------|
| `SCOUT_JWT_SECRET` | dev secret | **Yes** in production |
| `SCOUT_PORT` | `10009` | No |
| `SCOUT_DB_PATH` | `data/scout.db` | No |

### CI/CD

Push to `main` → typecheck + tests + build → Docker image → deploy to production. Fully automatic.

### Backup

```bash
docker cp scout:/app/data/scout.db ./backup/scout-$(date +%Y%m%d).db
```

## Development

```bash
pnpm dev          # API only
pnpm dev:all      # API + dashboard + widget
pnpm test         # run tests
pnpm typecheck    # TypeScript check
pnpm build        # production build
```

## License

MIT
