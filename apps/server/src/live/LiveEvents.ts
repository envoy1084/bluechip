import type { LiveEvent } from "@bluechip/domain/Events"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Stream from "effect/Stream"

/**
 * The hub every live event goes through: producers (the price feed, later deposits and trades) publish, each open
 * `/api/events` stream subscribes. Events for everyone for now; per-user events will carry a recipient.
 */
export class LiveEvents extends Context.Service<LiveEvents, {
  readonly publish: (event: LiveEvent) => Effect.Effect<void>
  /** Events published from the moment the stream is run. */
  readonly stream: Stream.Stream<LiveEvent>
}>()("@bluechip/server/LiveEvents") {
  static readonly layer = Layer.effect(
    LiveEvents,
    Effect.gen(function*() {
      const hub = yield* PubSub.unbounded<LiveEvent>()
      return {
        publish: (event) => PubSub.publish(hub, event).pipe(Effect.asVoid),
        stream: Stream.fromPubSub(hub)
      }
    })
  )
}
