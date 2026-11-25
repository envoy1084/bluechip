import { sql } from "drizzle-orm"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import { Database } from "../db/Database.ts"
import { release } from "../Release.ts"

/** `GET /health`: process and database state, for load balancers and humans. */
export const HealthRoutes = HttpRouter.add(
  "GET",
  "/health",
  Effect.gen(function*() {
    const db = yield* Database
    const database = yield* db.execute<{ hash: string; created_at: string }>(
      sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`
    ).pipe(
      Effect.map((rows) => ({ ok: true, migration: rows.rows[0]?.hash ?? null })),
      Effect.catch(() =>
        db.execute(sql`select 1`).pipe(
          Effect.as({ ok: true, migration: null }),
          Effect.orElseSucceed(() => ({ ok: false, migration: null }))
        )
      )
    )
    return HttpServerResponse.jsonUnsafe(
      { status: database.ok ? "ok" : "degraded", version: release, database },
      { status: database.ok ? 200 : 503 }
    )
  })
)
