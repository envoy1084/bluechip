import { ClientOutdated, Unauthenticated } from "@bluechip/domain/Errors"
import { heartbeatInterval, type LiveEvent } from "@bluechip/domain/Events"
import * as Data from "effect/Data"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as Reactivity from "effect/reactivity/Reactivity"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import { BluechipApiClient, liveReactivityKey } from "./client.ts"

/**
 * The state of the live stream, for the connection banner. `outdated` means this build must reload; `signedOut` means
 * the session ended (the stream needs one).
 */
export type Connection = "connecting" | "live" | "reconnecting" | "outdated" | "signedOut"

export const connectionAtom = Atom.make<Connection>("connecting")

/** The stream ended or went silent (a deploy, a restart, a dead proxy); treated like a dropped connection. */
class StreamClosed extends Data.TaggedError("StreamClosed") {}

const reconnectSchedule = Schedule.min([Schedule.exponential("1 second"), Schedule.spaced("30 seconds")])

/**
 * The latest live event. Mounted while a component reads it; reconnects with backoff, and after a reconnect refetches
 * every query tagged with {@link liveReactivityKey}.
 */
export const liveEventAtom = BluechipApiClient.runtime.atom((get) => {
  let reconnecting = false
  const setConnection = (connection: Connection) =>
    Effect.sync(() => {
      reconnecting = connection === "reconnecting"
      get.set(connectionAtom, connection)
    })
  return Stream.unwrap(BluechipApiClient.use((client) => client.events.watch())).pipe(
    Stream.tap(() =>
      reconnecting
        ? Effect.andThen(setConnection("live"), Reactivity.invalidate([liveReactivityKey]))
        : setConnection("live")
    ),
    Stream.timeoutOrElse({
      duration: Duration.times(heartbeatInterval, 3),
      orElse: () => Stream.fail(new StreamClosed())
    }),
    Stream.concat(Stream.fail(new StreamClosed())),
    Stream.catch((error) =>
      error instanceof ClientOutdated || error instanceof Unauthenticated
        ? Stream.drain(Stream.fromEffect(setConnection(error instanceof ClientOutdated ? "outdated" : "signedOut")))
          .pipe(Stream.concat(Stream.never))
        : Stream.fromEffect(setConnection("reconnecting")).pipe(Stream.drain, Stream.concat(Stream.fail(error)))
    ),
    Stream.retry(reconnectSchedule)
  )
})

/** The latest heartbeat, kept while other events arrive. */
export const heartbeatAtom = Atom.make((get): Extract<LiveEvent, { _tag: "Heartbeat" }> | undefined => {
  const result = get(liveEventAtom)
  if (AsyncResult.isSuccess(result) && result.value._tag === "Heartbeat") return result.value
  return Option.getOrUndefined(get.self<Extract<LiveEvent, { _tag: "Heartbeat" }> | undefined>())
})
