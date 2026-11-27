# syntax=docker/dockerfile:1.18
# check=skip=SecretsUsedInArgOrEnv
# The bluechip web app: the static build served by Caddy, which proxies the server's paths (apps/web/Caddyfile). Vite
# writes the VITE_* settings into the bundle, so each deployment builds its own image from build args. From the
# repository root:
#
#   docker build -f apps/web/Dockerfile --build-arg VITE_NETWORK=sepolia -t bluechip-web .
#
# Run it with SERVER_UPSTREAM (host:port of the server, `server:8080` by default); it serves on port 80.

ARG NODE_IMAGE=node:26.13.1-alpine3.24@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5
ARG CADDY_IMAGE=caddy:2.11.9-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0

FROM ${NODE_IMAGE} AS pnpm
# The version in package.json's packageManager (Node 26 ships no Corepack).
RUN npm install --global --no-fund --no-audit --no-update-notifier pnpm@12.21.0
WORKDIR /app

# Every package of the lockfile, downloaded into a store: this layer depends on the lockfile alone, so it survives
# every source change (pnpm's answer to `turbo prune`).
FROM pnpm AS fetch
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches patches
RUN pnpm fetch --store-dir /pnpm/store --cache-dir /pnpm/cache

# The web app and the workspace packages it builds from, with their build tools. Every manifest is copied so pnpm
# sees the workspace the lockfile describes (a new workspace member adds its line here). The devnet is only the chain
# package's test dependency.
FROM pnpm AS install
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches patches
COPY package.json ./
COPY apps/e2e/package.json apps/e2e/
COPY apps/server/package.json apps/server/
COPY apps/uikit/package.json apps/uikit/
COPY apps/web/package.json apps/web/
COPY packages/chain/package.json packages/chain/
COPY packages/devnet/package.json packages/devnet/
COPY packages/domain/package.json packages/domain/
COPY packages/ui/package.json packages/ui/
COPY scripts/package.json scripts/
COPY scratchpad/package.json scratchpad/
RUN --mount=type=bind,from=fetch,source=/pnpm,target=/pnpm,rw \
  pnpm install --offline --frozen-lockfile --ignore-scripts \
  --store-dir /pnpm/store --cache-dir /pnpm/cache --package-import-method copy \
  --filter "@bluechip/web..." --filter "!@bluechip/devnet"

FROM install AS build
RUN apk add --no-cache brotli
# Tailwind finds its classes in every file .gitignore doesn't exclude: without it, the client build would also read
# the server build's output, and the prerendered pages would link a stylesheet the client build never wrote.
COPY .gitignore ./
COPY packages/domain/src packages/domain/src
COPY packages/chain/src packages/chain/src
COPY packages/ui/src packages/ui/src
COPY apps/web apps/web

# The deployment's settings, written into the bundle (apps/web/.env.example). Only public values: the bundle is
# public (PostHog's project key too, so the secrets check is skipped above). VITE_NETWORK picks the chain, the site's
# origin and whether search engines index it.
ARG VITE_NETWORK=local
ARG VITE_SITE_URL=
ARG VITE_POSTHOG_PROJECT_API_KEY=
ARG VITE_POSTHOG_HOST=
ARG VITE_DEPLOYMENT_ENVIRONMENT=
ENV NODE_ENV=production \
  VITE_NETWORK=${VITE_NETWORK} \
  VITE_SITE_URL=${VITE_SITE_URL} \
  VITE_POSTHOG_PROJECT_API_KEY=${VITE_POSTHOG_PROJECT_API_KEY} \
  VITE_POSTHOG_HOST=${VITE_POSTHOG_HOST} \
  VITE_DEPLOYMENT_ENVIRONMENT=${VITE_DEPLOYMENT_ENVIRONMENT}

WORKDIR /app/apps/web
# Vite directly: `pnpm run` checks the whole workspace's install, and this one is filtered.
RUN node_modules/.bin/vite build
# Compressed once here, so Caddy serves text files without compressing them on every request.
RUN find dist/client -type f -size +1k \
  \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.json' -o -name '*.txt' \
  -o -name '*.xml' -o -name '*.webmanifest' \) \
  -exec gzip -9 -k {} + -exec brotli --best --keep {} +

FROM ${CADDY_IMAGE} AS runtime
ARG VITE_NETWORK=local
ARG VITE_POSTHOG_HOST=
ENV SITE_NETWORK=${VITE_NETWORK} \
  POSTHOG_HOST=${VITE_POSTHOG_HOST} \
  SERVER_UPSTREAM=server:8080
# Caddy keeps its state in /data and /config; the binary may bind port 80 without root (cap_net_bind_service).
RUN addgroup -S caddy && adduser -S -D -H -G caddy caddy && chown -R caddy:caddy /data /config
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist/client /srv

USER caddy
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1/healthz || exit 1
