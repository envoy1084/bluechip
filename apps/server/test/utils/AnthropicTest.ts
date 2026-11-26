// Anthropic's Messages API at the edge, in process: answers each request with the next body a test queued (as JSON,
// 200 OK) and counts the requests, so the real Anthropic client and language model run against known responses.
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"

export class AnthropicTest extends Context.Service<AnthropicTest, {
  /** Answers the next requests with these bodies, in order. */
  readonly answer: (...bodies: ReadonlyArray<unknown>) => Effect.Effect<void>
  /** How many requests reached Anthropic. */
  readonly requests: Effect.Effect<number>
}>()("@bluechip/server/test/AnthropicTest") {
  /** The queue and the `HttpClient` the Anthropic client sends with. */
  static readonly layer = Layer.unwrap(Effect.sync(() => {
    const bodies: Array<unknown> = []
    let requests = 0

    const client = HttpClient.make((request) =>
      Effect.sync(() => {
        requests++
        const body = bodies.shift()
        return HttpClientResponse.fromWeb(
          request,
          body === undefined
            ? new Response(null, { status: 500 })
            : new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })
        )
      })
    )

    return Layer.merge(
      Layer.succeed(AnthropicTest, {
        answer: (...next) => Effect.sync(() => void bodies.push(...next)),
        requests: Effect.sync(() => requests)
      }),
      Layer.succeed(HttpClient.HttpClient, client)
    )
  }))
}
