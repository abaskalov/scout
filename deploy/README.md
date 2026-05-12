# Deployment Examples

This directory contains generic deployment examples only. Do not commit production hostnames, SSH aliases, server paths, credentials, tokens, or real `.env` files.

Recommended production layout is to keep a local untracked compose file in this directory:

- `deploy/docker-compose.yml`
- `deploy/.env`
- `deploy/deploy.local.sh`

Use the tracked `*.example.*` files as templates and replace placeholders locally.

Important data safety rule: production `data/` and `storage/` volumes contain the SQLite database, screenshots, and session recordings. Never remove these volumes during deploy or rollback.
