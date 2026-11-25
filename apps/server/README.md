# @bluechip/server

bluechip's API server: Effect v4 on Node, Postgres through Drizzle ORM's Effect driver. It implements
`BluechipApi` from `@bluechip/domain` (Effect `HttpApi`) under `/api`, builds Namera v2 Kernel accounts for passkeys,
and runs scheduled jobs on Trigger.dev.

## Run locally

```sh
cp .env.example .env.local        # here; the root .env.local holds the fork's BASE_FORK_RPC_URL
docker compose --profile chain up -d   # Postgres, a Base fork (8545) and a bundler (4337)
pnpm --filter @bluechip/server db:migrate
pnpm --filter @bluechip/server dev
curl localhost:4000/health
curl localhost:4000/api/version
curl -N localhost:4000/api/events   # live events (Server-Sent Events)
open http://localhost:4000/api/docs  # API docs; the OpenAPI document is /api/openapi.json
```

The web app (`pnpm --filter @bluechip/web dev`) proxies `/api` and `/auth` to this server (`SERVER_ORIGIN`,
default `http://localhost:4000`); `localhost:3000/dev/connection` shows the connection live.

## Local chain

The fork keeps Base's chain id (8453), so contracts, Namera and signatures behave as on mainnet, with fake money.

- `pnpm --filter @bluechip/server dev:fund <address> --usdc 1000 --eth 1` sets an address's balances (refuses unless
  `NETWORK=local`).
- Set `BASE_FORK_RPC_URL` in the root `.env.local` to a Base RPC you control: the public endpoint rate-limits the fork. Pin `BASE_FORK_BLOCK`
  so Anvil's cache (the `foundry-cache` volume) serves restarts without RPC; restart at a newer weekday block to
  refresh prices, which freeze at the fork block.
- Gas: locally the account pays in fork ETH (`GAS_SPONSORSHIP=none`); in production Alchemy sponsors it.

## Jobs

Tasks live in `trigger/` and run their Effect programs with `JobsRuntime` (`src/Jobs.ts`). `pnpm --filter @bluechip/server jobs:login`
once, set `TRIGGER_PROJECT_REF`, then `pnpm --filter @bluechip/server jobs:dev` runs them on this machine;
`jobs:deploy` deploys them. Each run writes a `job_runs` row.

## Market

- Prices are each stock's Chainlink feed, read in one multicall every `PRICE_POLL_SECONDS` and sent to signed-in
  browsers as `PriceTick` events. Market status and price freshness use the latest block's time, so the fork behaves
  like Base at its block.
- The NYSE calendar (`src/market/Calendar.ts`) holds 2026-2028 holidays and early closes from NYSE's release; add
  2029 when NYSE publishes it.
- History lives in `price_points`: the `prices.snapshot` task adds each feed's latest answer every five minutes, and
  `pnpm --filter @bluechip/server prices:backfill --rpc-url <your Base RPC>` loads every past answer once (a few
  hundred calls read straight from Base; through the fork it would cost far more).
- Quotes come from each stock's Aerodrome pool (pinned in `@bluechip/chain`'s `Contracts.ts`) via the MetaDEX
  quoter.

## API

1. Define endpoints in `packages/domain/src/api/<Feature>Api.ts` and add the group in `packages/domain/src/Api.ts`
   (before the middleware, so it applies).
2. Implement them with `HttpApiBuilder.group` in `src/api/<Feature>.ts` and add the layer to `ApiHandlers` in
   `src/api/Api.ts`.
3. Errors are the domain's `Schema.TaggedError`s with an `httpApiStatus`; unexpected failures become
   `Internal { requestId }`. Clients send `x-contract-version`; a mismatch is `ClientOutdated` (426).

## Database changes

1. Edit the tables in `src/db/schema/` (custom column types in `src/db/columns.ts`).
2. `pnpm --filter @bluechip/server db:generate` writes a new SQL migration under `drizzle/`.
3. Read the SQL, commit it with the schema change. Never edit a generated migration; write a new one.
4. `db:migrate` applies pending migrations (`drizzle-orm/effect-postgres/migrator`); `db:studio` opens Drizzle Studio.

## Configuration

| Variable                | Default                 | Meaning                                                          |
| ----------------------- | ----------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`          | required                | Postgres connection string (redacted in logs)                    |
| `PORT`                  | `4000`                  | HTTP port                                                        |
| `PUBLIC_ORIGIN`         | `http://localhost:3000` | The web app's origin                                             |
| `NODE_ENV`              | `development`           | `development`, `test` or `production` (JSON logs in production)  |
| `LOG_LEVEL`             | `Info`                  | Minimum log level                                                |
| `NETWORK`               | `local`                 | `local` (the Anvil fork) or `base` (Base mainnet)                |
| `BASE_RPC_URL`          | `http://localhost:8545` | The node the server reads and sends through                      |
| `BUNDLER`               | `local`                 | `local` (Alto at `BUNDLER_URL`) or `alchemy`                     |
| `BUNDLER_URL`           | `http://localhost:4337` | The local bundler                                                |
| `GAS_SPONSORSHIP`       | `none`                  | `none`, `alchemy-bso` (Alchemy's bundler) or `alchemy-paymaster` |
| `ALCHEMY_API_KEY`       | —                       | Alchemy key (redacted), when `BUNDLER=alchemy`                   |
| `ALCHEMY_GAS_POLICY_ID` | —                       | Gas Manager policy that pays sponsored gas                       |
| `TRIGGER_PROJECT_REF`   | —                       | Trigger.dev project (`proj_…`)                                   |
| `PRICE_POLL_SECONDS`    | `15`                    | How often the server reads the price feeds                       |
