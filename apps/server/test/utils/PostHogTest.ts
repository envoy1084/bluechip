// PostHog's `/batch/` at the edge, in process: records each batch bluechip posts (where, the project key and the
// events) and answers 200, or the statuses a test queues (503 for PostHog busy).
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import type { PostHogMessage } from "../../src/modules/analytics/PostHogBatcher.ts"

/** A batch as PostHog received it. */
interface PostHogBatch {
  readonly url: string
  readonly api_key: string
  readonly batch: ReadonlyArray<PostHogMessage>
}

/** The fake's `HttpClient`, and the batches it received, oldest first. */
export const makePostHogTest = (...statuses: ReadonlyArray<number>) => {
  const received: Array<PostHogBatch> = []
  const answers = [...statuses]
  const client = HttpClient.make((request, url) =>
    Effect.sync(() => {
      const bytes = (request.body as { readonly body: Uint8Array }).body
      received.push({ url: url.toString(), ...JSON.parse(new TextDecoder().decode(bytes)) })
      return HttpClientResponse.fromWeb(request, new Response(null, { status: answers.shift() ?? 200 }))
    })
  )
  return { client, received: received as ReadonlyArray<PostHogBatch> }
}
