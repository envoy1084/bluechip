# Deploying bluechip on Dokploy

bluechip runs as two containers per deployment, built from this repository by Dokploy on the VPS:

```
browser ───────────▶ Traefik (Dokploy, TLS) ─┬─▶ bluechip.markets ─────▶ web (Caddy, :80): static pages
browser, Telegram ─▶                         └─▶ api.bluechip.markets ─▶ server (Node, :8080) ─▶ Postgres + pgvector
```

- **web** (`apps/web/Dockerfile`, `apps/web/Caddyfile`): the static build (prerendered `/` and `/legal/*`, the SPA
  shell `/_shell.html` for every other path) served by Caddy. It proxies nothing: the browser calls the server on its
  own domain (`VITE_API_URL`). `VITE_*` settings are written into the bundle, so they are **build args**.
- **server** (`apps/server/Dockerfile`): the API, the durable engine (crons, workflows) and the Telegram bot, on its
  own domain. It applies pending migrations, then starts. It answers CORS for the web app's origin (`PUBLIC_ORIGIN`)
  only, with credentials, and refuses writes from any other origin. Its settings are **runtime environment
  variables**.
- **postgres**: Postgres 18 with **pgvector** (the assistant's recall and the help center's search). Either Dokploy's
  managed database with the pgvector image, or the `postgres` service of `deploy/compose.yaml`.

Paper money (`paper.bluechip.markets` and `paper-api.bluechip.markets`, Base Sepolia) and production
(`bluechip.markets` and `api.bluechip.markets`, Base) are two Dokploy projects deploying the same
`deploy/compose.yaml` with their own environment, database, Telegram bot and keys. The web and its API are subdomains
of one site, so the server's host-only session cookie (`SameSite=Lax`, `Secure`, `HttpOnly`) goes with the page's
requests.

## 1. Before you start

- DNS: `A` records for `paper.bluechip.markets`, `paper-api.bluechip.markets`, `bluechip.markets` and
  `api.bluechip.markets` to the VPS.
- The VPS builds the images: give it about 4 GB of memory for the web build (Vite), and room for Docker's build cache.
- Contracts are deployed from a workstation, never from these images (`node scripts/bin.ts contracts deploy
  --network sepolia`; see `research/plan/025-testnet.md`).

## 2. Postgres with pgvector

Each deployment has its own database. The `vector` extension is created by the migrations, so the database user
must be allowed to create it (the image's `POSTGRES_USER` is a superuser).

**Option A, Dokploy's managed Postgres** (recommended: Dokploy's scheduled backups work on it). In the project,
Create Service → Database → PostgreSQL, and set its Docker image to
`pgvector/pgvector:0.8.1-pg18-trixie` (Dokploy's default `postgres` image has no pgvector, and the migrations fail on
`CREATE EXTENSION vector`). Postgres 18 images keep their data in `/var/lib/postgresql`; if Dokploy mounts the
volume at `/var/lib/postgresql/data` and the container refuses to start, change the mount path to
`/var/lib/postgresql`. Deploy it, then use its **internal** connection URL as the server's `DATABASE_URL`.

**Option B, the bundled service.** Set `COMPOSE_PROFILES=postgres` and `POSTGRES_PASSWORD` in the compose
service's environment, and `DATABASE_URL=postgres://bluechip:<password>@postgres:5432/bluechip`. Its data lives in
the compose project's `postgres` volume.

## 3. The compose service

In a Dokploy project (`bluechip-paper`, then `bluechip`): Create Service → Compose.

- Compose type: **Docker Compose** (not Stack: Stack mode doesn't build images).
- Provider: the GitHub repository, branch `main`, compose path `./deploy/compose.yaml`.
- Auto deploy on push, if wanted.

Dokploy writes the Environment tab to `deploy/.env`, which the server reads (`env_file`) and the web build's args
interpolate.

## 4. Environment

Every name, its meaning and its local default is in `apps/server/.env.example` and `apps/web/.env.example`. Never
reuse a value between paper and production.

**Web build args** (public: they ship in every page):

| Name                           | Paper                                | Production                     |
| ------------------------------ | ------------------------------------ | ------------------------------ |
| `VITE_NETWORK`                 | `sepolia`                            | `base`                         |
| `VITE_API_URL`                 | `https://paper-api.bluechip.markets` | `https://api.bluechip.markets` |
| `VITE_POSTHOG_PROJECT_API_KEY` | paper's project key                  | its own                        |
| `VITE_POSTHOG_HOST`            | `https://t.envoy1084.xyz`            | the same                       |
| `VITE_SITE_URL`                | unset (network's site)               | unset                          |
| `VITE_DEPLOYMENT_ENVIRONMENT`  | unset (`paper`)                      | unset                          |

The browser calls the server at `VITE_API_URL` (the API, its live stream, `/api/rpc` and the telemetry relay
`/api/sync/*`) and sends analytics straight to `VITE_POSTHOG_HOST` (PostHog's reverse proxy); the image's CSP allows
both in `connect-src`, and PostHog in `script-src`. Every network but `base` is `noindex` (its `robots.txt`, and Caddy's `X-Robots-Tag`); only production writes
`sitemap.xml`.

**Server** (`NODE_ENV=production` and `PORT=8080` are set by the compose file):

- Origins and passkeys: `PUBLIC_ORIGIN`, the web app's origin (`https://paper.bluechip.markets`: the passkeys'
  origin, links in messages, the only origin CORS allows), `RP_ID`, the web app's domain (`paper.bluechip.markets`;
  passkeys are bound to it for good: choose it once). The server's own origin, `API_ORIGIN`, is set by the compose
  file from `VITE_API_URL`.
- Database and keys: `DATABASE_URL`, `AGENT_KEY_ENCRYPTION_KEY` (`openssl rand -base64 32`; losing or changing it
  makes every agent's key unreadable, so keep a copy outside the VPS).
- Chain: `NETWORK` (`sepolia` or `base`, matching `VITE_NETWORK`), `BASE_RPC_URL`, `BUNDLER`, `BUNDLER_URL`,
  `GAS_SPONSORSHIP`, `ALCHEMY_API_KEY`, `ALCHEMY_GAS_POLICY_ID`; paper also `OPERATOR_PRIVATE_KEY`.
- Market data and models: `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY` (one live stream per Alpaca account: a key
  pair per deployment), `ANTHROPIC_API_KEY`, `ASSISTANT_MODEL`, `ASSISTANT_SMALL_MODEL`, `ASSISTANT_DAILY_BUDGET`,
  `VOYAGE_API_KEY`, `EMBEDDING_MODEL`.
- Web push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`node scripts/bin.ts vapid`), `VAPID_SUBJECT`.
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (`openssl rand -hex 32`); see
  below.
- Telemetry and analytics: `DEPLOYMENT_ENVIRONMENT` (`paper` or `production`), `AXIOM_TOKEN`, `AXIOM_DOMAIN`,
  `AXIOM_EDGE_DOMAIN`, `AXIOM_TRACES_DATASET`, `AXIOM_LOGS_DATASET`, `AXIOM_METRICS_DATASET`, `TRACE_SAMPLE_READS`,
  and the server's PostHog settings listed in `apps/server/.env.example`.
- Schedules: `RECONCILE_ENABLED`, `SCHEDULES_ENABLED` (both on by default).

**Compose** (only with the bundled Postgres): `COMPOSE_PROFILES=postgres`, `POSTGRES_PASSWORD`, and optionally
`POSTGRES_USER`, `POSTGRES_DB`.

## 5. Domains

Domains tab → Add domain, twice, HTTPS on with Let's Encrypt, path `/`:

- service **web**, host `paper.bluechip.markets` (production: `bluechip.markets`), container port **80**. Caddy
  sends HSTS (one year) and the security headers itself, so Traefik needs no middleware.
- service **server**, host `paper-api.bluechip.markets` (production: `api.bluechip.markets`), container port
  **8080**.

Dokploy adds Traefik's labels and network to both. Deploy, then check `https://paper-api.bluechip.markets/api/version`
(the server's network) and the landing page.

## 6. Telegram

With `NODE_ENV=production` the bot takes updates by webhook. At startup the server registers
`API_ORIGIN/telegram/webhook` (`https://paper-api.bluechip.markets/telegram/webhook`, or `TELEGRAM_WEBHOOK_URL`) with
`TELEGRAM_WEBHOOK_SECRET` itself; Telegram posts to the server's domain. Use a separate bot per deployment (a bot has one webhook). To check it:
`curl https://api.telegram.org/bot<token>/getWebhookInfo`.

## 7. Backups

- Option A: the database's Backups tab, with an S3 destination (Dokploy → Settings → S3 Destinations), daily.
- Option B: a Dokploy schedule on the compose service running
  `pg_dump -U bluechip -d bluechip -Fc > /var/lib/postgresql/backup.dump` in the `postgres` container, then copied
  off the VPS, or Dokploy's volume backups of the `postgres` volume.
- Keep `AGENT_KEY_ENCRYPTION_KEY`, the VAPID keys and the operator key outside the VPS too: a database restore is
  useless without the first.

Restore into an empty database; the server migrates it forward on start.

## 8. Operations

- **Migrations** run on every start, before the server listens (`node src/bin/migrate.ts && exec node src/main.ts`).
  A failed migration stops the container, so the previous schema is never served by new code. To run them alone:
  the server container's terminal in Dokploy, or on the VPS
  `docker compose -p <project> -f deploy/compose.yaml run --rm --no-deps server node src/bin/migrate.ts`.
- **One server per deployment.** The durable engine runs as a single runner (crons, workflows, the account desk):
  never scale `server` past one replica, and keep Compose mode, which stops the old container before starting the
  new one. Migrations take no lock, for the same reason.
- **Deploys** rebuild both images. While the server restarts, API requests fail (Traefik answers 502) and the app
  retries; live streams reconnect on their own.
- **Logs** are JSON on stdout (Dokploy's Logs tab); traces, logs and metrics also go to Axiom when configured.
- **Release**: `/health` and `/api/version` report `0.0.0`, because the images start Node directly rather than
  through pnpm (`npm_package_version`).

## Trying the images locally

```sh
docker build -f apps/server/Dockerfile -t bluechip-server .
docker build -f apps/web/Dockerfile --build-arg VITE_NETWORK=local \
  --build-arg VITE_API_URL=http://localhost:8082 -t bluechip-web .
docker run --rm -p 8081:80 bluechip-web
```

Run the server on `-p 8082:8080` with a throwaway environment (`NETWORK=local`, a database of its own,
`PUBLIC_ORIGIN=http://localhost:8081`, `RP_ID=localhost`, `API_ORIGIN=http://localhost:8082`,
`DEPLOYMENT_ENVIRONMENT` unset so nothing is exported), then open `http://localhost:8081`. Never test with paper's or
production's secrets.
