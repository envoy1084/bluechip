# @bluechip/server

bluechip's API server: Effect v4 on Node, Postgres through Drizzle ORM's Effect driver. It implements
`BluechipApi` from `@bluechip/domain` (Effect `HttpApi`) under `/api`.

## Run locally

```sh
cp .env.example .env              # at the repository root
docker compose up -d              # Postgres 18 on localhost:5432
pnpm --filter @bluechip/server db:migrate
pnpm --filter @bluechip/server dev
curl localhost:4000/health
curl localhost:4000/api/version
curl -N localhost:4000/api/events   # live events (Server-Sent Events)
open http://localhost:4000/api/docs  # API docs; the OpenAPI document is /api/openapi.json
```

The web app (`pnpm --filter @bluechip/web dev`) proxies `/api` and `/auth` to this server (`SERVER_ORIGIN`,
default `http://localhost:4000`); `localhost:3000/dev/connection` shows the connection live.

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

| Variable        | Default                 | Meaning                                                         |
| --------------- | ----------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`  | required                | Postgres connection string (redacted in logs)                   |
| `PORT`          | `4000`                  | HTTP port                                                       |
| `PUBLIC_ORIGIN` | `http://localhost:3000` | The web app's origin                                            |
| `NODE_ENV`      | `development`           | `development`, `test` or `production` (JSON logs in production) |
| `LOG_LEVEL`     | `Info`                  | Minimum log level                                               |
