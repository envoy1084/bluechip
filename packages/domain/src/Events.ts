/**
 * Live events, streamed to the web app over Server-Sent Events. Pages load with normal requests, then events update
 * them; after a reconnect the client refetches, so a missed event never leaves stale data.
 *
 * @since 0.0.0
 */
import * as Duration from "effect/Duration"
import * as Schema from "effect/Schema"
import { ReferencePrice } from "./market/Market.ts"

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
  Heartbeat: { at: Schema.DateTimeUtc, sequence: Schema.Int },
  /** Reference prices that changed since the last tick. */
  PriceTick: { prices: Schema.Array(ReferencePrice) }
}).annotate({ identifier: "@bluechip/domain/Events/LiveEvent" })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type LiveEvent = typeof LiveEvent.Type
