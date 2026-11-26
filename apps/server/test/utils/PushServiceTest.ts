// Browsers' push services at the edge, in process: records each push bluechip sends (where, its headers and its
// encrypted body) and answers 201 Created, or the statuses a test queues (410 for a device that's gone).
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"

/** A push as the push service received it. */
export interface PushRequest {
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: Uint8Array
}

export class PushServiceTest extends Context.Service<PushServiceTest, {
  /** Answers the next pushes with these statuses, before answering 201 again. */
  readonly answer: (...statuses: ReadonlyArray<number>) => Effect.Effect<void>
  /** The pushes sent to `endpoint`, oldest first. */
  readonly to: (endpoint: string) => Effect.Effect<ReadonlyArray<PushRequest>>
}>()("@bluechip/server/test/PushServiceTest") {
  /** The recordings and the `HttpClient` the server sends pushes with. */
  static readonly layer = Layer.unwrap(Effect.sync(() => {
    const received: Array<PushRequest> = []
    const statuses: Array<number> = []

    const client = HttpClient.make((request, url) =>
      Effect.sync(() => {
        received.push({
          url: url.toString(),
          headers: request.headers,
          body: (request.body as { readonly body: Uint8Array }).body
        })
        return HttpClientResponse.fromWeb(request, new Response(null, { status: statuses.shift() ?? 201 }))
      })
    )

    return Layer.merge(
      Layer.succeed(PushServiceTest, {
        answer: (...next) => Effect.sync(() => void statuses.push(...next)),
        to: (endpoint) => Effect.sync(() => received.filter((request) => request.url === endpoint))
      }),
      Layer.succeed(HttpClient.HttpClient, client)
    )
  }))
}
