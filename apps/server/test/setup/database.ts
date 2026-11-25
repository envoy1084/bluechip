import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Database } from "../../src/db/Database.ts"
import { testDatabaseUrl } from "../support/config.ts"

// Migrates the test database once per run, so test files share it and run in parallel.
export default async () => {
  await Effect.runPromise(
    Layer.build(Database.layerMigrated).pipe(
      Effect.scoped,
      Effect.asVoid,
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ DATABASE_URL: testDatabaseUrl })))
    )
  )
}
