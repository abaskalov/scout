# Scout Agent

Autonomous AI agent that fixes bugs reported through Scout.

Polls the Scout API for new bugs → determines the affected repository → runs Claude Code to fix → creates a Pull Request → updates bug status in Scout.

## How it works

```
Scout (bugs) ──→ Agent ──→ Claude Code ──→ git push + PR ──→ Scout (status: review)
```

1. Agent polls Scout API for `new` + `unassigned` bugs
2. Claims the bug
3. Clones/pulls the project's repositories into workspace
4. Passes bug context to Claude Code (description, URL, selector, recording)
5. Claude Code analyzes the context, finds the right repo, fixes the bug
6. Agent pushes the branch and creates a PR via `gh`
7. Updates the bug status to `review` in Scout

## Quick start

### Docker (recommended)

```bash
cd orchestrator

# 1. Configure
cp agent.yaml.example agent.yaml   # edit: repos, credentials
cp .env.example .env                # edit: API keys

# 2. Run
docker compose up -d

# 3. Check logs
docker compose logs -f scout-agent
```

### Local

```bash
# From the scout root directory
export SCOUT_URL=http://localhost:10009
export ANTHROPIC_API_KEY=sk-ant-xxx
export GITHUB_TOKEN=ghp_xxx
export SCOUT_WORKSPACE=/Users/you/Work/avtozor

pnpm orchestrator
```

For local usage, set `POLL_INTERVAL=0` for a single run, or omit it for continuous polling (default: 300s).

## Configuration

Configuration is loaded from `agent.yaml` with environment variable overrides.

### agent.yaml

```yaml
scout_url: https://scout.kafu.kz
agent_email: agent@scout.local
agent_password: secret
workspace: /workspace
poll_interval: 300
agent_bin: claude
max_attempts: 3

projects:
  my-project:
    repos:
      - git@github.com:org/frontend.git
      - git@github.com:org/backend-api.git
```

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SCOUT_URL` | Scout API URL | `http://localhost:10009` |
| `SCOUT_AGENT_EMAIL` | Agent login email | `agent@scout.local` |
| `SCOUT_AGENT_PASSWORD` | Agent login password | `agent` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude Code | (required) |
| `GITHUB_TOKEN` | GitHub token for PR creation | (required) |
| `SCOUT_WORKSPACE` | Directory for cloned repos | `/workspace` |
| `POLL_INTERVAL` | Seconds between polls (0 = single run) | `300` |
| `MAX_ATTEMPTS` | Max fix attempts per bug | `3` |
| `SCOUT_AGENT_BIN` | AI agent binary | `claude` |

## Adding a new project

1. Create a project in Scout dashboard (set name, slug, enable autofix)
2. Add the project to `agent.yaml`:
   ```yaml
   projects:
     my-new-project:  # must match the Scout project slug
       repos:
         - git@github.com:org/repo.git
   ```
3. Restart the agent: `docker compose restart scout-agent`

## Architecture

```
orchestrator/
  process-bugs.ts    — Main loop: poll → claim → fix → PR → update
  config.ts          — YAML + env var config loader
  scout-client.ts    — Typed HTTP client for Scout API
  parse-recording.ts — rrweb session recording parser
  agent-prompt.md    — System prompt for Claude Code
  Dockerfile         — Agent container image
  docker-compose.yaml
  agent.yaml.example
```

The agent is **stateless** — workspace is a Docker volume that persists cloned repos between restarts for faster git operations. The agent can be safely restarted at any time.
