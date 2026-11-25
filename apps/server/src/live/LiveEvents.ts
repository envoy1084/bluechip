import type { LiveEvent } from "@bluechip/domain/Events"
import type { UserId } from "@bluechip/domain/Ids"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"

interface Delivery {
  readonly event: LiveEvent
  /** `undefined` for everyone (prices); a user for their own money (deposits, withdrawals, portfolio). */
  readonly to: UserId | undefined
}

/**
 * The hub every live event goes through: producers (the price feed, the deposit watcher, withdrawals) publish, each
 * open `/api/events` stream subscribes and only sees events for everyone or for its own user.
 */
export class LiveEvents extends Context.Service<LiveEvents, {
  /** Sends `event` to every stream, or only to `to`'s streams. */
  readonly publish: (event: LiveEvent, to?: UserId) => Effect.Effect<void>
  /**
   * Subscribes now (for the scope) to the events `user` may see: every event published after this returns is in the
   * stream, so a caller can subscribe, then act, without missing what its action publishes.
   */
  readonly subscribe: (user: UserId) => Effect.Effect<Stream.Stream<LiveEvent>, never, Scope.Scope>
}>()("@bluechip/server/LiveEvents") {
  static readonly layer = Layer.effect(
    LiveEvents,
    Effect.gen(function*() {
      const hub = yield* PubSub.unbounded<Delivery>()
      return {
        publish: (event, to) => PubSub.publish(hub, { event, to }).pipe(Effect.asVoid),
        subscribe: (user) =>
          Effect.map(PubSub.subscribe(hub), (subscription) =>
            Stream.fromSubscription(subscription).pipe(
              Stream.filter((delivery) => delivery.to === undefined || delivery.to === user),
              Stream.map((delivery) => delivery.event)
            ))
      }
    })
  )
}
