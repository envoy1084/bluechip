import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import { heartbeatInterval, LiveEvent } from "@bluechip/domain/Events"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Stream from "effect/Stream"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { HttpActiveStreams, record } from "../../platform/telemetry/Metrics.ts"

export const EventsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "events",
  Effect.fn(function*(handlers) {
    const live = yield* LiveEvents
    // Streams open on this server, for `http.server.active_streams` (the stream itself is never traced).
    let open = 0
    const opened = (change: 1 | -1) =>
      Effect.suspend(() => record(HttpActiveStreams, open += change, { "http.route": "/api/events" }))

    return handlers.handleAll({
      watch: Effect.fn(function*() {
        const user = yield* CurrentUser
        const heartbeats = Stream.tick(heartbeatInterval).pipe(
          Stream.zipWithIndex,
          Stream.mapEffect(([, sequence]) =>
            Effect.map(DateTime.now, (at): LiveEvent => LiveEvent.cases.Heartbeat.make({ at, sequence }))
          )
        )
        // Subscribed before the first heartbeat: a client that has heard one misses no event published after it.
        return Stream.unwrap(Effect.map(live.subscribe(user.id), (events) => Stream.merge(heartbeats, events))).pipe(
          Stream.onStart(opened(1)),
          Stream.ensuring(opened(-1))
        )
      })
    })
  })
)
