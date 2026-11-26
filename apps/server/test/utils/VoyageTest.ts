// Voyage's embeddings endpoint at the edge, in process: records each request and answers as Voyage does (one vector
// per input, listed last to first, so the client must place them by `index`), or with the statuses a test queues.
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"
import { DIMENSIONS } from "../../src/platform/embeddings/Embeddings.ts"

/** A request as Voyage received it. */
export interface VoyageRequest {
  readonly url: string
  readonly authorization: string | undefined
  readonly body: {
    readonly model: string
    readonly input: ReadonlyArray<string>
    readonly input_type: string | null
    readonly output_dimension: number
  }
}

/** An answer that isn't a success: its status, and the wait it asks for. */
export interface VoyageFailure {
  readonly status: number
  readonly retryAfter?: string
}

export class VoyageTest extends Context.Service<VoyageTest, {
  /** Answers the next requests with these statuses (and headers), before answering normally again. */
  readonly fail: (...answers: ReadonlyArray<VoyageFailure>) => Effect.Effect<void>
  readonly requests: Effect.Effect<ReadonlyArray<VoyageRequest>>
}>()("@bluechip/server/test/VoyageTest") {
  /** The recordings and the `HttpClient` that sends to them. The vector for input `i` is `[i + 1, 0, 0, …]`. */
  static readonly layer = Layer.unwrap(Effect.sync(() => {
    const received: Array<VoyageRequest> = []
    const failures: Array<VoyageFailure> = []

    const client = HttpClient.make((request, url) =>
      Effect.sync(() => {
        const body = JSON.parse(
          new TextDecoder().decode((request.body as { readonly body: Uint8Array }).body)
        ) as VoyageRequest["body"]
        received.push({ url: url.toString(), authorization: request.headers["authorization"], body })

        const failure = failures.shift()
        if (failure !== undefined) {
          return HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify({ detail: "refused" }), {
              status: failure.status,
              headers: failure.retryAfter === undefined ? {} : { "retry-after": failure.retryAfter }
            })
          )
        }
        const data = body.input.map((_, index) => ({
          object: "embedding",
          index,
          embedding: Array.from({ length: body.output_dimension }, (_, at) => at === 0 ? index + 1 : 0)
        })).reverse()
        return HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify({ object: "list", data, model: body.model, usage: { total_tokens: 10 } }), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        )
      })
    )

    return Layer.merge(
      Layer.succeed(VoyageTest, {
        fail: (...answers) => Effect.sync(() => void failures.push(...answers)),
        requests: Effect.sync(() => [...received])
      }),
      Layer.succeed(HttpClient.HttpClient, client)
    )
  }))
}

/** The vector the endpoint returns for the input at `index`. */
export const voyageVector = (index: number) => Array.from({ length: DIMENSIONS }, (_, at) => at === 0 ? index + 1 : 0)
