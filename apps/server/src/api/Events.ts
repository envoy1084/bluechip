import { BluechipApi } from "@bluechip/domain/Api"
import { heartbeatInterval, LiveEvent } from "@bluechip/domain/Events"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Stream from "effect/Stream"
import { LiveEvents } from "../live/LiveEvents.ts"

export const EventsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "events",
  (handlers) =>
    handlers.handle("watch", () =>
      Effect.gen(function*() {
        const live = yield* LiveEvents
        const heartbeats = Stream.tick(heartbeatInterval).pipe(
          Stream.zipWithIndex,
          Stream.mapEffect(([, sequence]) =>
            Effect.map(DateTime.now, (at): LiveEvent => LiveEvent.cases.Heartbeat.make({ at, sequence }))
          )
        )
        return Stream.merge(heartbeats, live.stream)
      }))
)
