import { ChainClient } from "@bluechip/chain/ChainClient"
import { assert, describe, layer } from "@effect/vitest"
import { eq } from "drizzle-orm"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Database } from "../src/db/Database.ts"
import { jobRuns } from "../src/db/schema/jobRuns.ts"
import { recordHeartbeat } from "../src/jobs/Heartbeat.ts"
import { chainAvailable } from "./fork.ts"

const databaseUrl = "postgres://bluechip:bluechip@localhost:5432/bluechip"

const TestLayer = Layer.mergeAll(
  Database.layerMigrated.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ DATABASE_URL: databaseUrl })))
  ),
  Layer.succeed(ChainClient, ChainClient.make("local", "http://localhost:8545"))
)

describe.skipIf(!chainAvailable)("heartbeat job", () => {
  layer(TestLayer)((it) => {
    it.effect("records a run with the fork's block number", () =>
      Effect.gen(function*() {
        const run = yield* recordHeartbeat
        const db = yield* Database
        const [stored] = yield* db.select().from(jobRuns).where(eq(jobRuns.id, run.id))
        assert.strictEqual(stored?.task, "heartbeat")
        assert.strictEqual(stored?.status, "succeeded")
        assert.isTrue(BigInt(String(stored?.detail["blockNumber"])) > 0n)
        yield* db.delete(jobRuns).where(eq(jobRuns.id, run.id))
      }))
  })
})
