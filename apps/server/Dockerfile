# syntax=docker/dockerfile:1.18
# The bluechip server: Node runs its TypeScript as written (type stripping), so the image keeps the workspace's layout
# (/app/packages/*, /app/apps/server) and its pnpm symlinks, whose real paths stay outside node_modules (Node refuses
# to strip types there, which rules out `pnpm deploy`). Build from the repository root:
#
#   docker build -f apps/server/Dockerfile --build-arg APP_VERSION=$(git rev-parse --short HEAD) -t bluechip-server .
#
# Run it with the server's environment (apps/server/.env.example, deploy/README.md). It applies pending migrations,
# then serves on PORT (8080).

ARG NODE_IMAGE=node:26.13.1-alpine3.24@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5

FROM ${NODE_IMAGE} AS pnpm
# The version in package.json's packageManager (Node 26 ships no Corepack).
RUN npm install --global --no-fund --no-audit --no-update-notifier pnpm@12.21.0
WORKDIR /app

# Every production package of the lockfile, downloaded into a store: this layer depends on the lockfile alone, so it
# survives every source change (pnpm's answer to `turbo prune`).
FROM pnpm AS fetch
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches patches
RUN pnpm fetch --prod --store-dir /pnpm/store --cache-dir /pnpm/cache

# The server and the workspace packages it depends on, production dependencies only. Every manifest is copied so pnpm
# sees the workspace the lockfile describes (a new workspace member adds its line here). The libraries take effect
# and viem as peers (devDependencies in the workspace), so they are hoisted to /app/node_modules, where the
# libraries' sources resolve them. The devnet is only the chain package's test dependency.
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
  pnpm install --offline --frozen-lockfile --prod --ignore-scripts \
  --store-dir /pnpm/store --cache-dir /pnpm/cache --package-import-method copy \
  --public-hoist-pattern effect --public-hoist-pattern viem \
  --filter "@bluechip/server..." --filter "!@bluechip/devnet"

FROM ${NODE_IMAGE} AS runtime
# tini forwards signals and reaps children: the server shuts down gracefully (2 s) on SIGTERM.
RUN apk add --no-cache tini
ENV NODE_ENV=production \
  PORT=8080
WORKDIR /app

# The manifests and node_modules folders pnpm linked, then the sources beside them.
COPY --from=install /app /app
COPY packages/domain/src packages/domain/src
COPY packages/chain/src packages/chain/src
# The help center's articles, read at runtime from content/help beside the repository's layout (Knowledge.ts).
COPY content content
COPY apps/server/drizzle apps/server/drizzle
COPY apps/server/src apps/server/src

# The release `/health` and `/api/version` report (deploy/README.md): the commit deployed. Last, so a new one rebuilds
# no layer above.
ARG APP_VERSION=
ENV APP_VERSION=${APP_VERSION}

USER node
WORKDIR /app/apps/server
EXPOSE 8080

# Migrations take a few seconds on a fresh database; the engine and market data start after them.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=4 \
  CMD wget --quiet --spider "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
# Migrations first, then the server as tini's only child. A one-off command replaces this
# (`docker run … node src/bin/migrate.ts`).
CMD ["sh", "-c", "node src/bin/migrate.ts && exec node src/main.ts"]
