import { assert, describe, it } from "@effect/vitest"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as TestClock from "effect/testing/TestClock"
import { Embeddings } from "../../../../src/platform/embeddings/Embeddings.ts"
import { VoyageTest, voyageVector } from "../../../utils/VoyageTest.ts"

const voyage = Embeddings.layerNoDeps.pipe(
  Layer.provideMerge(VoyageTest.layer),
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ VOYAGE_API_KEY: "test-key" })))
)

describe("Embeddings on Voyage", () => {
  it.effect("embeds documents as documents, one vector per text in order", () =>
    Effect.gen(function*() {
      const embeddings = yield* Embeddings

      const vectors = yield* embeddings.documents(["You avoid Tesla.", "You like chip makers."])
      const requests = yield* (yield* VoyageTest).requests

      assert.deepStrictEqual(
        [vectors, requests],
        [[voyageVector(0), voyageVector(1)], [{
          url: "https://api.voyageai.com/v1/embeddings",
          authorization: "Bearer test-key",
          body: {
            model: "voyage-4",
            input: ["You avoid Tesla.", "You like chip makers."],
            input_type: "document",
            output_dimension: 1024,
            truncation: true
          } as never
        }]]
      )
    }).pipe(Effect.provide(voyage)))

  it.effect("embeds a query as a query", () =>
    Effect.gen(function*() {
      const embeddings = yield* Embeddings

      const vector = yield* embeddings.query("what do I avoid?")
      const [request] = yield* (yield* VoyageTest).requests

      assert.deepStrictEqual([vector, request?.body.input, request?.body.input_type], [
        voyageVector(0),
        ["what do I avoid?"],
        "query"
      ])
    }).pipe(Effect.provide(voyage)))

  it.effect("sends 100 documents in batches of 64", () =>
    Effect.gen(function*() {
      const embeddings = yield* Embeddings
      const texts = Array.from({ length: 100 }, (_, index) => `memory ${index}`)

      const vectors = yield* embeddings.documents(texts)
      const requests = yield* (yield* VoyageTest).requests

      assert.deepStrictEqual([vectors.length, requests.map((request) => request.body.input.length)], [100, [64, 36]])
    }).pipe(Effect.provide(voyage)))

  it.effect("no documents send nothing", () =>
    Effect.gen(function*() {
      const embeddings = yield* Embeddings

      const vectors = yield* embeddings.documents([])
      const requests = yield* (yield* VoyageTest).requests

      assert.deepStrictEqual([vectors, requests.length], [[], 0])
    }).pipe(Effect.provide(voyage)))

  it.effect("a 429 is retried after the wait Voyage asks for", () =>
    Effect.gen(function*() {
      const embeddings = yield* Embeddings
      const voyageTest = yield* VoyageTest
      yield* voyageTest.fail({ status: 429, retryAfter: "2" })

      const fiber = yield* Effect.forkChild(embeddings.query("Nvidia"))
      yield* TestClock.adjust("1 second")
      const early = (yield* voyageTest.requests).length
      yield* TestClock.adjust("10 seconds")
      const vector = yield* Fiber.join(fiber)

      assert.deepStrictEqual([early, (yield* voyageTest.requests).length, vector], [1, 2, voyageVector(0)])
    }).pipe(Effect.provide(voyage)))

  it.effect("a 503 is retried", () =>
    Effect.gen(function*() {
      const embeddings = yield* Embeddings
      const voyageTest = yield* VoyageTest
      yield* voyageTest.fail({ status: 503 })

      const fiber = yield* Effect.forkChild(embeddings.query("Nvidia"))
      yield* TestClock.adjust("10 seconds")
      yield* Fiber.join(fiber)

      assert.strictEqual((yield* voyageTest.requests).length, 2)
    }).pipe(Effect.provide(voyage)))

  it.effect("a refused key fails at once", () =>
    Effect.gen(function*() {
      const embeddings = yield* Embeddings
      const voyageTest = yield* VoyageTest
      yield* voyageTest.fail({ status: 401 })

      const error = yield* Effect.flip(embeddings.query("Nvidia"))

      assert.deepStrictEqual([error.reason._tag, (yield* voyageTest.requests).length], ["AuthenticationError", 1])
    }).pipe(Effect.provide(voyage)))
})

describe("Embeddings.layerTest", () => {
  it.effect("texts sharing words are closer than texts that don't", () =>
    Effect.gen(function*() {
      const embeddings = yield* Embeddings
      const [query, related, unrelated] = yield* embeddings.documents([
        "Which stocks do I avoid?",
        "You avoid Tesla stock.",
        "Your agent bought Apple."
      ])
      const cosine = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) =>
        a.reduce((sum, value, index) => sum + value * b[index]!, 0)

      assert.isAbove(cosine(query!, related!), cosine(query!, unrelated!))
    }).pipe(Effect.provide(Embeddings.layerTest)))
})
