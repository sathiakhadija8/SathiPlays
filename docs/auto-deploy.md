# Auto Deploy Setup (GitHub Actions)

This project now includes:
- Workflow: `.github/workflows/deploy-prod.yml`
- Server deploy script: `scripts/auto-deploy-prod.sh`

## What it does
On each push to `main`, GitHub Actions SSHes into your server and runs:
1. `git fetch/pull` for latest code
2. `npm run ops:preflight`
3. `npm run backup:db`
4. `npm run db:migrate:prod:up`
5. `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build`
6. `npm run ops:health`

## Required GitHub Secrets
Set these in your repo: `Settings -> Secrets and variables -> Actions`

- `DEPLOY_HOST`: server hostname/IP
- `DEPLOY_PORT`: SSH port (usually `22`)
- `DEPLOY_USER`: SSH user
- `DEPLOY_PATH`: absolute path to project on server
- `DEPLOY_SSH_KEY`: private SSH key for that user
- `DEPLOY_HOST_KEY` (recommended): known_hosts line for your server (`ssh-ed25519 ...`)

If `DEPLOY_HOST_KEY` is omitted, the workflow falls back to `ssh-keyscan`.

## Server prerequisites
On your server at `DEPLOY_PATH`:
- repo cloned
- `.env.production` exists and is correct
- Docker + Docker Compose plugin installed
- Node.js + npm installed

## Manual trigger
Use `Actions -> Deploy Production -> Run workflow` and choose branch if needed.

## Notes
- Deploy will fail if the server git working tree is dirty (safety check).
- Migrations run on every deploy and only apply pending files.
