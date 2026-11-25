import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { LoggingLive } from "../config/Logging.ts"
import { Database } from "../platform/db/Database.ts"

// Applies every pending migration in `drizzle/` to DATABASE_URL, then exits.
const program = Effect.gen(function*() {
  yield* Database
  yield* Effect.logInfo("Database is migrated to the latest schema")
})

NodeRuntime.runMain(program.pipe(Effect.provide(Layer.provide(Database.layerMigrated, LoggingLive))))
