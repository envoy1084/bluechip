import { ChainClient } from "@bluechip/chain/ChainClient"
import { assert, describe, layer } from "@effect/vitest"
import { eq } from "drizzle-orm"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Database } from "../../src/db/Database.ts"
import { jobRuns } from "../../src/db/schema/jobRuns.ts"
import { snapshotPrices } from "../../src/jobs/PriceSnapshot.ts"
import { chainAvailable } from "../support/fork.ts"

const TestLayer = Layer.mergeAll(
  Database.layerMigrated.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({
      DATABASE_URL: "postgres://bluechip:bluechip@localhost:5432/bluechip"
    })))
  ),
  Layer.succeed(ChainClient, ChainClient.make("local", "http://localhost:8545"))
)

describe.skipIf(!chainAvailable)("prices.snapshot job", () => {
  layer(TestLayer)((it) => {
    it.effect("stores every stock's latest answer and records the run", () =>
      Effect.gen(function*() {
        const run = yield* snapshotPrices
        assert.strictEqual(run.status, "succeeded")
        assert.strictEqual(run.detail["stocks"], 13)
        const db = yield* Database
        yield* db.delete(jobRuns).where(eq(jobRuns.id, run.id))
      }))
  })
})
