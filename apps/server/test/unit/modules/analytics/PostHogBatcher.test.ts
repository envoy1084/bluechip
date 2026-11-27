import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as HttpClient from "effect/http/HttpClient"
import * as Redacted from "effect/Redacted"
import * as Scope from "effect/Scope"
import * as TestClock from "effect/testing/TestClock"
import { makeBatcher, type PostHogMessage } from "../../../../src/modules/analytics/PostHogBatcher.ts"
import { makePostHogTest } from "../../../utils/PostHogTest.ts"

// Three events, as `Analytics` builds them.
const MESSAGES: ReadonlyArray<PostHogMessage> = [1, 2, 3].map((n) => ({
  event: "trade_filled",
  distinct_id: "user_1",
  uuid: `uuid-${n}`,
  timestamp: "2026-11-27T12:00:00.000Z",
  properties: { n }
}))

const options = {
  host: "https://us.i.posthog.com/",
  projectKey: Redacted.make("phc_test"),
  interval: "5 seconds",
  maxBatch: 3,
  attempts: 3
} as const

describe("makeBatcher", () => {
  it.effect("two events wait for the interval, then go in one batch to /batch/ with the project key", () =>
    Effect.gen(function*() {
      const { client, received } = makePostHogTest()
      const send = yield* makeBatcher(options).pipe(Effect.provideService(HttpClient.HttpClient, client))
      yield* TestClock.adjust("1 second")

      yield* send(MESSAGES[0]!)
      yield* send(MESSAGES[1]!)
      const before = received.length
      yield* TestClock.adjust("5 seconds")

      assert.strictEqual(before, 0)
      assert.deepStrictEqual(received, [{
        url: "https://us.i.posthog.com/batch/",
        api_key: "phc_test",
        batch: [MESSAGES[0]!, MESSAGES[1]!]
      }])
    }).pipe(Effect.scoped))

  it.effect("a full batch goes at once, before the interval", () =>
    Effect.gen(function*() {
      const { client, received } = makePostHogTest()
      const send = yield* makeBatcher(options).pipe(Effect.provideService(HttpClient.HttpClient, client))
      yield* TestClock.adjust("1 second")

      yield* Effect.forEach(MESSAGES, send)
      yield* Effect.yieldNow

      assert.deepStrictEqual(received.map((received) => received.batch.length), [3])
    }).pipe(Effect.scoped))

  it.effect("PostHog busy (503) once: the batch is sent again, and lands once", () =>
    Effect.gen(function*() {
      const { client, received } = makePostHogTest(503)
      const send = yield* makeBatcher(options).pipe(Effect.provideService(HttpClient.HttpClient, client))
      yield* TestClock.adjust("1 second")

      yield* send(MESSAGES[0]!)
      yield* TestClock.adjust("5 seconds")
      yield* TestClock.adjust("1 second")

      assert.deepStrictEqual(received.map((received) => received.batch.map((sent) => sent.uuid)), [["uuid-1"], [
        "uuid-1"
      ]])
    }).pipe(Effect.scoped))

  it.effect("PostHog failing three times: the batch is dropped, and the next one goes", () =>
    Effect.gen(function*() {
      const { client, received } = makePostHogTest(500, 500, 500)
      const send = yield* makeBatcher(options).pipe(Effect.provideService(HttpClient.HttpClient, client))
      yield* TestClock.adjust("1 second")

      yield* send(MESSAGES[0]!)
      yield* TestClock.adjust("5 seconds")
      yield* TestClock.adjust("10 seconds")
      yield* send(MESSAGES[1]!)
      yield* TestClock.adjust("5 seconds")

      assert.deepStrictEqual(
        received.map((received) => received.batch.map((sent) => sent.uuid)),
        [["uuid-1"], ["uuid-1"], ["uuid-1"], ["uuid-2"]]
      )
    }).pipe(Effect.scoped))

  it.effect("a batch PostHog refuses (400) is not sent again", () =>
    Effect.gen(function*() {
      const { client, received } = makePostHogTest(400)
      const send = yield* makeBatcher(options).pipe(Effect.provideService(HttpClient.HttpClient, client))
      yield* TestClock.adjust("1 second")

      yield* send(MESSAGES[0]!)
      yield* TestClock.adjust("5 seconds")
      yield* TestClock.adjust("10 seconds")

      assert.strictEqual(received.length, 1)
    }).pipe(Effect.scoped))

  it.effect("the server stopping: what waits is sent before it goes", () =>
    Effect.gen(function*() {
      const { client, received } = makePostHogTest()
      const scope = yield* Scope.make()
      const send = yield* makeBatcher(options).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
        Scope.provide(scope)
      )
      yield* TestClock.adjust("1 second")

      yield* send(MESSAGES[0]!)
      yield* Scope.close(scope, Exit.void)

      assert.deepStrictEqual(received.map((received) => received.batch.map((sent) => sent.uuid)), [["uuid-1"]])
    }))
})
