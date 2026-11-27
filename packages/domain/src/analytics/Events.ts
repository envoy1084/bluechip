/**
 * The analytics event catalogue: every event bluechip sends to PostHog, who sends it (the server or the web app) and
 * its typed properties. The server captures only server events, the web app only web events.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { SERVER_EVENTS, type ServerEvent } from "./ServerEvents.ts"
import { WEB_EVENTS, type WebEvent } from "./WebEvents.ts"

/**
 * Any analytics event.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AnalyticsEvent = Schema.Union([...SERVER_EVENTS, ...WEB_EVENTS])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AnalyticsEvent = ServerEvent | WebEvent

/**
 * An event's name, as PostHog shows it.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type EventName = AnalyticsEvent["_tag"]

/**
 * One entry of the catalogue: an event's name, who sends it and its property names.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface EventInfo {
  readonly name: EventName
  readonly by: "server" | "web"
  readonly properties: ReadonlyArray<string>
}

const info = (by: EventInfo["by"]) => (event: (typeof SERVER_EVENTS | typeof WEB_EVENTS)[number]): EventInfo => ({
  name: event.fields._tag.schema.literal,
  by,
  properties: Object.keys(event.fields).filter((field) => field !== "_tag")
})

/**
 * Every event, server events first.
 *
 * @stability unstable
 * @category catalog
 * @since 0.0.0
 */
export const EVENTS: ReadonlyArray<EventInfo> = [...SERVER_EVENTS.map(info("server")), ...WEB_EVENTS.map(info("web"))]

/**
 * An event as PostHog's capture takes it: its name, and its properties without the tag.
 *
 * @stability unstable
 * @category capture
 * @since 0.0.0
 */
export const toCapture = (
  event: AnalyticsEvent
): { readonly event: EventName; readonly properties: Readonly<Record<string, unknown>> } => {
  const { _tag, ...properties } = event
  return { event: _tag, properties }
}
