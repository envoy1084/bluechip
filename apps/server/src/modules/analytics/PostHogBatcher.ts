import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Redacted from "effect/Redacted"
import * as Schedule from "effect/Schedule"
import * as Schema from "effect/Schema"
import * as Semaphore from "effect/Semaphore"

/** One event as PostHog's `/batch/` endpoint takes it. */
export interface PostHogMessage {
  readonly event: string
  readonly distinct_id: string
  readonly uuid: string
  /** ISO time of the fact, not of the send: PostHog dedupes on it with the uuid. */
  readonly timestamp: string
  readonly properties: Readonly<Record<string, unknown>>
}

/** Where and how often batches go. */
export interface BatcherOptions {
  /** PostHog's ingest host (`https://us.i.posthog.com`). */
  readonly host: string
  readonly projectKey: Redacted.Redacted<string>
  /** How long an event waits for others before its batch goes. */
  readonly interval: Duration.Input
  /** The most events in one batch; a full batch goes at once. */
  readonly maxBatch: number
  /** Tries per batch before it is dropped. */
  readonly attempts: number
}

// Worth trying again: the request never got an answer, PostHog is busy (429) or failed (5xx). A 4xx is our mistake.
class PostHogUnavailable extends Schema.TaggedError<PostHogUnavailable>()("PostHogUnavailable", {
  reason: Schema.String
}) {}

/**
 * Collects events and posts them to PostHog's `/batch/` in batches: every `interval`, or as soon as `maxBatch` are
 * waiting, and once more when the scope closes (the server stopping). A batch that fails is tried again with
 * backoff, then dropped with a warning after `attempts` tries; analytics never holds up or fails what it measures.
 * Returns `enqueue`.
 */
export const makeBatcher = Effect.fnUntraced(function*(options: BatcherOptions) {
  const client = yield* HttpClient.HttpClient
  const url = `${options.host.replace(/\/+$/, "")}/batch/`
  const waiting: Array<PostHogMessage> = []
  const sending = yield* Semaphore.make(1)
  const scope = yield* Effect.scope

  const post = (batch: ReadonlyArray<PostHogMessage>) =>
    client.execute(
      HttpClientRequest.post(url).pipe(
        HttpClientRequest.bodyJsonUnsafe({ api_key: Redacted.value(options.projectKey), batch })
      )
    ).pipe(
      Effect.mapError((error) => new PostHogUnavailable({ reason: error.message })),
      Effect.flatMap((response) =>
        response.status < 300 ?
          Effect.void :
          response.status === 429 || response.status >= 500 ?
          Effect.fail(new PostHogUnavailable({ reason: `${response.status}` })) :
          Effect.die(new Error(`PostHog refused a batch: ${response.status}`))
      ),
      Effect.retry({
        times: options.attempts - 1,
        schedule: Schedule.exponential("1 second")
      }),
      Effect.catchCause((cause) =>
        Effect.logWarning(`Analytics: dropped ${batch.length} events after ${options.attempts} tries`, cause)
      )
    )

  // Sends everything waiting, a batch at a time, one flush at a time.
  const flush = sending.withPermit(Effect.whileLoop({
    while: () => waiting.length > 0,
    body: () => post(waiting.splice(0, options.maxBatch)),
    step: () => {}
  }))

  yield* flush.pipe(Effect.repeat(Schedule.spaced(options.interval)), Effect.forkIn(scope))
  yield* Effect.addFinalizer(() => flush)

  return (message: PostHogMessage): Effect.Effect<void> =>
    Effect.suspend(() => {
      waiting.push(message)
      return waiting.length >= options.maxBatch ? Effect.asVoid(Effect.forkIn(flush, scope)) : Effect.void
    })
})
