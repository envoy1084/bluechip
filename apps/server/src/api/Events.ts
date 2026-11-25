import { BluechipApi } from "@bluechip/domain/Api"
import { LiveEvent } from "@bluechip/domain/Events"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Stream from "effect/Stream"

/** How often the stream sends a heartbeat; the client shows the connection as live while they arrive. */
const heartbeatInterval = "5 seconds"

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
