import type { PersonProperties } from "@bluechip/domain/analytics/Person"
import type { ServerEvent } from "@bluechip/domain/analytics/ServerEvents"
import type { UserId } from "@bluechip/domain/Ids"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { TelemetryConfig } from "../../platform/telemetry/TelemetryConfig.ts"
import { eventUuid } from "./EventIds.ts"
import type { AiEvent } from "./LlmEvents.ts"
import { makeDeletePerson } from "./PostHogAdmin.ts"
import { makeBatcher, type PostHogMessage } from "./PostHogBatcher.ts"

/** The fact an event tells: what makes it one, when it happened, and what it changes about the person. */
interface Fact {
  /**
   * The fact's own id (an intent and its status, a trade, a user): the event's uuid is made from it, so telling the
   * same fact twice (a step retried) is one event.
   */
  readonly id: string
  /** When it happened (now when unset): PostHog dedupes on the uuid with this time, so it must be the fact's. */
  readonly at?: DateTime.Utc | undefined
  readonly set?: PersonProperties | undefined
  /** Properties set only the first time (`signed_up_at`, `first_trade_at`). */
  readonly setOnce?: PersonProperties | undefined
}

/** What every event carries, whoever tells it. */
interface CommonProperties {
  readonly network: string
  readonly environment: string
  readonly app_version: string
}

/** Where `make` sends what it built. */
interface AnalyticsSink {
  readonly send: (message: PostHogMessage) => Effect.Effect<void>
  readonly deletePerson: (distinctId: string) => Effect.Effect<void>
  readonly common: CommonProperties
  readonly captureText: boolean
}

/**
 * Product analytics from the server (PostHog): the catalogue's server events and the LLM analytics events, each
 * told once where the fact is known, after the change it tells has committed. Every event carries the network, the
 * environment, the app's version and the trace it happened in. Never fails what it measures.
 */
export class Analytics extends Context.Service<Analytics, {
  /** Tells `event` about the user (or about bluechip itself, `null`: a person-less system event). */
  readonly capture: (userId: UserId | null, event: ServerEvent | AiEvent, fact: Fact) => Effect.Effect<void>
  /** Sets person properties with no event of their own (`$set`). */
  readonly identify: (userId: UserId, fact: Fact) => Effect.Effect<void>
  /** Deletes the person and their events from PostHog (the account deleted). */
  readonly deletePerson: (userId: UserId) => Effect.Effect<void>
  /** Whether LLM analytics may carry prompts and answers (`LLM_ANALYTICS_CAPTURE_TEXT`). */
  readonly capturesText: boolean
}>()("@bluechip/server/Analytics") {
  /** Analytics on `sink`. Tests build `AnalyticsTest` on it with a sink in memory. */
  static readonly make = (sink: AnalyticsSink): Analytics["Service"] => {
    const system = `system:${sink.common.environment}`

    const message = Effect.fnUntraced(function*(
      userId: UserId | null,
      name: string,
      properties: Readonly<Record<string, unknown>>,
      fact: Fact
    ) {
      const span = yield* Effect.option(Effect.currentParentSpan)
      const at = fact.at ?? (yield* DateTime.now)
      return {
        event: name,
        distinct_id: userId ?? system,
        uuid: eventUuid(fact.id, name),
        timestamp: DateTime.formatIso(at),
        properties: {
          // Unset optional properties are left out, as JSON would.
          ...Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined)),
          ...sink.common,
          ...(Option.isSome(span) ? { trace_id: span.value.traceId } : {}),
          // The network is a person property too: a person signs up on one network for good.
          ...(userId === null ? {} : { $set: { network: sink.common.network, ...fact.set } }),
          ...(fact.setOnce === undefined ? {} : { $set_once: fact.setOnce }),
          $process_person_profile: userId !== null
        }
      } satisfies PostHogMessage
    })

    const tell = Effect.fnUntraced(function*(
      userId: UserId | null,
      name: string,
      properties: Readonly<Record<string, unknown>>,
      fact: Fact
    ) {
      yield* sink.send(yield* message(userId, name, properties, fact))
    })

    return Analytics.of({
      capture: (userId, event, fact) => {
        const { _tag, ...properties } = event
        return tell(userId, _tag, properties, fact)
      },
      identify: (userId, fact) => tell(userId, "$set", {}, fact),
      deletePerson: (userId) => sink.deletePerson(userId),
      capturesText: sink.captureText
    })
  }

  /** Analytics that tells nothing: development, tests that don't read it, and deployments without PostHog's key. */
  static readonly layerNoop = Layer.succeed(
    Analytics,
    Analytics.of({
      capture: () => Effect.void,
      identify: () => Effect.void,
      deletePerson: () => Effect.void,
      capturesText: false
    })
  )

  /**
   * PostHog on paper and production with `POSTHOG_PROJECT_API_KEY` (to `POSTHOG_HOST`, batched every 5 s or 100
   * events, flushed when the server stops); deleting a person needs `POSTHOG_PERSONAL_API_KEY` (and
   * `POSTHOG_PROJECT_ID`, else read from the key). Nothing anywhere else.
   */
  static readonly layer = Layer.unwrap(Effect.gen(function*() {
    const telemetry = yield* TelemetryConfig
    const projectKey = yield* Config.option(Config.Redacted("POSTHOG_PROJECT_API_KEY"))
    if (telemetry.posthog === undefined || Option.isNone(projectKey)) return Analytics.layerNoop

    const personalKey = yield* Config.option(Config.Redacted("POSTHOG_PERSONAL_API_KEY"))
    const projectId = yield* Config.option(Config.Int("POSTHOG_PROJECT_ID"))
    const captureText = yield* Config.Boolean("LLM_ANALYTICS_CAPTURE_TEXT").pipe(Config.withDefault(false))
    const host = telemetry.posthog.ingest

    return Layer.effect(
      Analytics,
      Effect.gen(function*() {
        const send = yield* makeBatcher({
          host,
          projectKey: projectKey.value,
          interval: "5 seconds",
          maxBatch: 100,
          attempts: 3
        })
        const deletePerson = Option.isNone(personalKey) ?
          () => Effect.logWarning("Analytics: no POSTHOG_PERSONAL_API_KEY, so the person stays in PostHog") :
          yield* makeDeletePerson({ host, personalKey: personalKey.value, projectId: Option.getOrUndefined(projectId) })
        yield* Effect.logInfo(`Analytics: sending to PostHog (${telemetry.environment}, ${telemetry.network})`)
        return Analytics.make({
          send,
          deletePerson,
          captureText,
          common: { network: telemetry.network, environment: telemetry.environment, app_version: telemetry.release }
        })
      })
    )
  }))
}
