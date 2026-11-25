# @bluechip/server

bluechip's API server: Effect v4 on Node, Postgres through Drizzle ORM's Effect driver.

## Run locally

```sh
cp .env.example .env              # at the repository root
docker compose up -d              # Postgres 18 on localhost:5432
pnpm --filter @bluechip/server db:migrate
pnpm --filter @bluechip/server dev
curl localhost:4000/health
```

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
