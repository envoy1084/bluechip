// Product analytics in memory: the server's `Analytics` on its real implementation (uuids, common properties),
// sending to a list a test reads instead of PostHog.
import type { UserId } from "@bluechip/domain/Ids"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Analytics } from "../../src/modules/analytics/Analytics.ts"
import type { PostHogMessage } from "../../src/modules/analytics/PostHogBatcher.ts"

/** An event as a test compares it: its name and its own properties, without those every event carries. */
interface Told {
  readonly event: string
  readonly properties: Readonly<Record<string, unknown>>
}

// What `Analytics` adds to every event; one test checks them, the rest compare what the event itself says.
const COMMON = new Set(["network", "environment", "app_version", "trace_id", "$process_person_profile"])

export class AnalyticsTest extends Context.Service<AnalyticsTest, {
  /** The events sent about `distinctId` (a user id, or `system:<env>`), as PostHog receives them, oldest first. */
  readonly messages: (distinctId: UserId | string) => Effect.Effect<ReadonlyArray<PostHogMessage>>
  /** The events sent about `userId` (those named `events` only, when given), oldest first. */
  readonly told: (userId: UserId, ...events: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<Told>>
  /** The people deleted from PostHog, by distinct id. */
  readonly deleted: Effect.Effect<ReadonlyArray<string>>
}>()("@bluechip/server/test/AnalyticsTest") {
  /** `Analytics` sending to memory, with `AnalyticsTest` reading it. */
  static readonly layer = Layer.unwrap(Effect.sync(() => {
    const sent: Array<PostHogMessage> = []
    const deleted: Array<string> = []

    const analytics = Layer.succeed(
      Analytics,
      Analytics.make({
        send: (message) => Effect.sync(() => void sent.push(message)),
        deletePerson: (distinctId) => Effect.sync(() => void deleted.push(distinctId)),
        captureText: false,
        common: { network: "local", environment: "development", app_version: "test" }
      })
    )

    const messages = (distinctId: string) =>
      Effect.sync(() => sent.filter((message) => message.distinct_id === distinctId))

    return Layer.merge(
      analytics,
      Layer.succeed(AnalyticsTest, {
        messages,
        told: (userId, ...events) =>
          Effect.map(
            messages(userId),
            (all) =>
              all.filter((message) => events.length === 0 || events.includes(message.event)).map((message) => ({
                event: message.event,
                properties: Object.fromEntries(
                  Object.entries(message.properties).filter(([property]) => !COMMON.has(property))
                )
              }))
          ),
        deleted: Effect.sync(() => [...deleted])
      })
    )
  }))
}
