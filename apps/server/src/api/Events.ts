import { BluechipApi } from "@bluechip/domain/Api"
import { heartbeatInterval, LiveEvent } from "@bluechip/domain/Events"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Stream from "effect/Stream"

export const EventsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "events",
  (handlers) =>
    handlers.handle("watch", () =>
      Effect.succeed(
        Stream.tick(heartbeatInterval).pipe(
          Stream.zipWithIndex,
          Stream.mapEffect(([, sequence]) =>
            Effect.map(DateTime.now, (at) => LiveEvent.cases.Heartbeat.make({ at, sequence }))
          )
        )
      ))
)
