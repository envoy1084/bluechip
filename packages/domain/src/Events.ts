/**
 * Live events, streamed to the web app over Server-Sent Events. Pages load with normal requests, then events update
 * them; after a reconnect the client refetches, so a missed event never leaves stale data.
 *
 * @since 0.0.0
 */
import * as Duration from "effect/Duration"
import * as Schema from "effect/Schema"

/**
 * How often the server sends a `Heartbeat`. A client that hears nothing for a few intervals treats the connection as
 * dropped: proxies can keep a dead stream open without ever closing it.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const heartbeatInterval = Duration.seconds(5)

/**
 * Every live event. Features add their cases here (`PriceTick`, `PortfolioChanged`, …).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const LiveEvent = Schema.TaggedUnion({
  /** Sent every few seconds, so the client can show that the stream is alive. */
  Heartbeat: { at: Schema.DateTimeUtc, sequence: Schema.Int }
}).annotate({ identifier: "@bluechip/domain/Events/LiveEvent" })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type LiveEvent = typeof LiveEvent.Type
