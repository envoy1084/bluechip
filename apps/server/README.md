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
curl localhost:8080/health
curl localhost:8080/api/version
curl -N localhost:8080/api/events   # live events (Server-Sent Events)
open http://localhost:8080/api/docs  # API docs; the OpenAPI document is /api/openapi.json
```

The web app (`pnpm --filter @bluechip/web dev`) proxies `/api` and `/auth` to this server (`SERVER_ORIGIN`,
default `http://localhost:8080`); `localhost:3000/dev/connection` shows the connection live.

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

- Market prices come from Alpaca (`src/market/alpaca/`): one snapshot request for every stock at startup and every
  5 minutes (latest trade and previous close), its trade stream in between, sent to signed-in browsers as
  `PriceTick` events at most once a second. Share prices become token prices with each B20 token's multiplier,
  read from the chain once a day. Only the server holds the Alpaca keys; the free plan allows one stream connection
  per account, so local and production use separate keys.
- Charts are Alpaca's bars, cached per stock and range (1D for a minute, 1W for 5 minutes, longer ranges an hour)
  and shared by every viewer. Nothing about prices is stored.
- Chainlink is read on demand (`ReferencePrices`): one multicall shared for 15 seconds serves quotes (the fair-price
  check) and the stock pages' reference line. Nothing reads it while nobody asks.
- Sessions (`src/market/Calendar.ts`): regular, pre-market, after-hours and overnight while prices move (Sunday
  8 pm to Friday 8 pm New York), paused on weekends and NYSE holidays (2026-2028 from NYSE's release; add 2029 when
  it's published). The stock tokens trade around the clock either way.
- Quotes come from each stock's Aerodrome pool (pinned in `@bluechip/chain`'s `Contracts.ts`) via the MetaDEX
  quoter.

## Funding and portfolio

- Balances are read from the chain when a page needs them (one call for all 14 assets, kept 15 seconds); nothing
  watches accounts in the background. The Add cash screen asks every few seconds while it's open.
- Withdrawals: `POST /api/withdrawals` builds the user operation and returns its hash as a WebAuthn challenge; the
  browser signs it with the account's passkey; `POST /api/withdrawals/:id/confirm` checks the signature, sends it and
  follows it to its receipt (`TransferUpdated` events). Requests are single-use and expire after 2 minutes.
- The portfolio chart is `portfolio_snapshots`: the `portfolio.snapshot` task values every account every 4 hours
  (one balance read per 200 accounts) and keeps 30 days.
- `POST /api/dev/fund` (local fork only) sends the signed-in account 1,000 test USDC as a real transfer, plus ETH
  for gas.

## Trading

- `POST /api/trades` reads the account's balances, quotes the stock's pool, checks the price against a fresh
  Chainlink read and builds one user operation: `approve` then the Aerodrome swap, with a 0.5% slippage floor, a
  3-minute deadline and at least `swapCallGas` call gas (Anvil underestimates swaps through B20 tokens).
- The fair-price check refuses a trade more than 1% worse than Chainlink, 0.5% while prices are paused (weekends,
  holidays; trading stays open for people and agents, with a warning), and any trade while Chainlink missed its
  heartbeat.
- Signing is shared with withdrawals (`src/signing/`): the passkey signs the operation's hash, `confirm` sends it,
  and the trade is followed to its receipt, where its fill (exact USDC and shares) is read from the logs.
- `GET /api/activity` lists trades and withdrawals together, newest first.

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
| `PORT`                  | `8080`                  | HTTP port                                                        |
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
| `ALPACA_API_KEY_ID`     | required                | Alpaca market data key (paper account is enough)                 |
| `ALPACA_API_SECRET_KEY` | required                | Its secret (redacted)                                            |
| `ALPACA_FEED`           | `iex`                   | `iex` (free plan) or `sip` (Algo Trader Plus)                    |
