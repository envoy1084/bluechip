import { assert, describe, layer } from "@effect/vitest"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Workflow from "effect/workflow/Workflow"
import { randomUUID } from "node:crypto"
import { Database } from "../../src/db/Database.ts"
import { engineLayer } from "../../src/engine/Engine.ts"
import { testDatabaseUrl } from "../support/config.ts"

// The engine's message ids are time-based snowflakes: these tests run on the real clock (`excludeTestServices`), since a frozen
// test clock repeats ids across runs in the shared test database.

// How many times the probe's handler ran, per key.
const runs = new Map<string, number>()

const Probe = Workflow.make("EngineProbe", {
  payload: { key: Schema.String },
  success: Schema.Number,
  idempotencyKey: ({ key }) => key
})

const ProbeLive = Probe.toLayer(({ key }) =>
  Effect.sync(() => {
    const count = (runs.get(key) ?? 0) + 1
    runs.set(key, count)
    return count
  })
)

const TestEngine = ProbeLive.pipe(
  Layer.provideMerge(engineLayer({ runnerStorage: "memory" })),
  Layer.provide(Database.layer),
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ DATABASE_URL: testDatabaseUrl })))
)

layer(TestEngine, { excludeTestServices: true })("the durable engine", (it) => {
  describe("a workflow", () => {
    it.effect("executed twice with the same key runs once and answers both times", () =>
      Effect.gen(function*() {
        const key = randomUUID()

        const first = yield* Probe.execute({ key })
        const second = yield* Probe.execute({ key })

        assert.deepStrictEqual([first, second, runs.get(key)], [1, 1, 1])
      }))

    it.effect("executed with another key runs again", () =>
      Effect.gen(function*() {
        const [a, b] = [randomUUID(), randomUUID()]

        yield* Probe.execute({ key: a })
        yield* Probe.execute({ key: b })

        assert.deepStrictEqual([runs.get(a), runs.get(b)], [1, 1])
      }))
  })
})
