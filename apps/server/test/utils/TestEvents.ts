// A user's live events, read from the typed client's Server-Sent Events stream as the web app reads them.
import type { LiveEvent } from "@bluechip/domain/Events"
import * as Effect from "effect/Effect"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"

/** The events of one open stream, in order. */
export interface TestEvents {
  /** Reads until an event with `tag` matches, skipping the others; dies if the stream ends first. */
  readonly next: <const Tag extends LiveEvent["_tag"]>(
    tag: Tag,
    match?: (event: Extract<LiveEvent, { readonly _tag: Tag }>) => boolean
  ) => Effect.Effect<Extract<LiveEvent, { readonly _tag: Tag }>>
}

/**
 * Opens `watch` (the user's `events.watch` endpoint) for the scope. Returns once the first heartbeat has arrived: the
 * server subscribes before sending it, so events published by actions taken afterwards are never missed.
 */
export const open = Effect.fnUntraced(function*<E, StreamE, R>(
  watch: Effect.Effect<Stream.Stream<LiveEvent, StreamE>, E, R>
) {
  const stream = yield* Effect.orDie(watch)
  const queue = yield* Stream.toQueue(stream, { capacity: "unbounded" })

  const next = <const Tag extends LiveEvent["_tag"]>(
    tag: Tag,
    match: (event: Extract<LiveEvent, { readonly _tag: Tag }>) => boolean = () => true
  ): Effect.Effect<Extract<LiveEvent, { readonly _tag: Tag }>> =>
    Effect.flatMap(
      Effect.orDie(Queue.take(queue)),
      (event) =>
        event._tag === tag && match(event as Extract<LiveEvent, { readonly _tag: Tag }>)
          ? Effect.succeed(event as Extract<LiveEvent, { readonly _tag: Tag }>)
          : next(tag, match)
    )

  yield* next("Heartbeat")
  const events: TestEvents = { next }
  return events
})
