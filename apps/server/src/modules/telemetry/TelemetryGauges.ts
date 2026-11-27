import { ChainClient } from "@bluechip/chain/ChainClient"
import { readPrices } from "@bluechip/chain/market/Prices"
import { TRIGGERS } from "@bluechip/domain/automations/Automation"
import { bpsBetween, Price } from "@bluechip/domain/market/Units"
import { type SQL, sql } from "drizzle-orm"
import * as Singleton from "effect/cluster/Singleton"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import { Database } from "../../platform/db/Database.ts"
import { Embeddings } from "../../platform/embeddings/Embeddings.ts"
import {
  AgentsActive,
  AgentsSessionsExpiring,
  AutomationsActive,
  DbConnections,
  DeskQueue,
  EmbeddingsBacklog,
  EngineBacklog,
  GasPrice,
  type Instrument,
  IntentsOpen,
  MarketFeedGap,
  MarketPriceAge,
  OutboxAge,
  OutboxPending,
  record,
  UsersActive
} from "../../platform/telemetry/Metrics.ts"
import { MarketPrices } from "../market/MarketPrices.ts"

const OPEN_STATUSES = ["proposed", "deciding", "waiting", "needsApproval", "awaitingSignature", "sending", "confirming"]

/**
 * The gauges that need a question asked: a handful of `count(*)`s, the pool's connections, the gas price and how old
 * the market's prices are, every minute on one runner (`sample`), and who was active and which agent sessions end
 * soon every hour (`sampleHourly`). Their spans are ticks marked idle, so they make no traces unless one fails.
 */
export class TelemetryGauges extends Context.Service<TelemetryGauges, {
  readonly sample: Effect.Effect<void>
  readonly sampleHourly: Effect.Effect<void>
}>()("@bluechip/server/TelemetryGauges") {
  static readonly layer = Layer.effect(
    TelemetryGauges,
    Effect.gen(function*() {
      const db = yield* Database
      const chain = yield* ChainClient
      const market = yield* MarketPrices
      const embeddings = yield* Embeddings

      const counts = (query: SQL) =>
        db.execute<{ readonly label: string | null; readonly n: number }>(query).pipe(
          Effect.map((result) => new Map(result.rows.map((row) => [row.label ?? "", Number(row.n)]))),
          Effect.orDie
        )

      // Every label set, zero when nothing counted: a gauge keeps its last value otherwise.
      const setAll = <K extends string>(
        instrument: Instrument<K>,
        key: K,
        labels: ReadonlyArray<string>,
        found: ReadonlyMap<string, number>
      ) =>
        Effect.forEach(
          labels,
          (label) => record(instrument, found.get(label) ?? 0, { [key]: label } as { readonly [k in K]: string }),
          { discard: true }
        )

      const business = Effect.gen(function*() {
        yield* setAll(
          IntentsOpen,
          "status",
          OPEN_STATUSES,
          yield* counts(sql`select status as label, count(*)::int as n from intents
            where status in ${OPEN_STATUSES} group by status`)
        )
        yield* setAll(
          AgentsActive,
          "state",
          ["active", "paused", "needs_renewal"],
          yield* counts(sql`select case when status = 'expired' then 'needs_renewal'
              when paused then 'paused' else 'active' end as label, count(*)::int as n
            from agents where status in ('active', 'updating', 'expired') group by 1`)
        )
        const triggers = TRIGGERS.map((trigger) => trigger.type as string)
        yield* setAll(
          AutomationsActive,
          "trigger",
          triggers,
          yield* counts(sql`select trigger->>'type' as label, count(*)::int as n from automations
            where status = 'active' group by 1`)
        )
        const backlog = yield* counts(sql`select 'rows' as label, count(*)::int as n from recall_entries
          where model is null or model <> ${embeddings.model}`)
        yield* record(EmbeddingsBacklog, backlog.get("rows") ?? 0, {})
      })

      const operations = Effect.gen(function*() {
        const outbox = yield* db.execute<{ readonly n: number; readonly age: number | null }>(
          sql`select count(*)::int as n, extract(epoch from now() - min(created_at))::float as age
            from notification_outbox`
        ).pipe(Effect.orDie)
        yield* record(OutboxPending, Number(outbox.rows[0]?.n ?? 0), {})
        yield* record(OutboxAge, Number(outbox.rows[0]?.age ?? 0), {})

        const engine = yield* counts(sql`select entity_type as label, count(*)::int as n from cluster_messages
          where not processed group by entity_type`)
        for (const [entity, n] of engine) yield* record(EngineBacklog, n, { entity })
        yield* record(DeskQueue, engine.get("AccountDesk") ?? 0, {})

        yield* setAll(
          DbConnections,
          "state",
          ["idle", "used", "waiting"],
          yield* counts(sql`select case when wait_event_type = 'Lock' then 'waiting'
              when state = 'idle' then 'idle' else 'used' end as label, count(*)::int as n
            from pg_stat_activity where datname = current_database() group by 1`)
        )
      })

      const chainAndMarket = Effect.gen(function*() {
        const gas = yield* chain.use("gas price", (client) => client.getGasPrice())
        yield* record(GasPrice, Number(gas) / 1e9, {})

        const now = yield* DateTime.now
        const prices = yield* market.prices
        const feeds = yield* readPrices(chain)
        for (const [symbol, price] of prices) {
          yield* record(MarketPriceAge, (now.epochMilliseconds - price.tradedAt.epochMilliseconds) / 1000, {
            source: "alpaca",
            symbol
          })
        }
        for (const feed of feeds.prices) {
          const symbol = feed.stock.symbol
          yield* record(MarketPriceAge, (now.epochMilliseconds - feed.updatedAt.getTime()) / 1000, {
            source: "chainlink",
            symbol
          })
          const alpaca = prices.get(symbol as never)
          if (alpaca !== undefined) {
            const gap = bpsBetween(Price.make(alpaca.price), Price.make(feed.price))
            yield* record(MarketFeedGap, Math.abs(gap), { symbol })
          }
        }
      })

      const sample = Effect.gen(function*() {
        yield* Effect.annotateCurrentSpan("bluechip.idle", true)
        yield* Effect.all([business, operations, chainAndMarket.pipe(Effect.ignore)], {
          concurrency: "unbounded",
          discard: true
        })
      }).pipe(Effect.withSpan("TelemetryGauges.sample"))

      const sampleHourly = Effect.gen(function*() {
        yield* Effect.annotateCurrentSpan("bluechip.idle", true)
        for (const [window, days] of [["1d", 1], ["7d", 7], ["30d", 30]] as const) {
          const active = yield* counts(sql`select 'users' as label, count(distinct user_id)::int as n from (
              select user_id from sessions where coalesce(last_seen_at, created_at) > now() - make_interval(days => ${days})
              union all select user_id from intents where created_at > now() - make_interval(days => ${days})
            ) seen`)
          yield* record(UsersActive, active.get("users") ?? 0, { window })
        }
        for (const [within, hours] of [["24h", 24], ["7d", 168]] as const) {
          const ending = yield* counts(sql`select 'sessions' as label, count(*)::int as n from agent_sessions
            where status = 'active' and valid_until < now() + make_interval(hours => ${hours})`)
          yield* record(AgentsSessionsExpiring, ending.get("sessions") ?? 0, { within })
        }
      }).pipe(Effect.withSpan("TelemetryGauges.sample"))

      return TelemetryGauges.of({ sample, sampleHourly })
    })
  )

  /** Every minute and every hour, on one runner of the cluster. */
  static readonly watch = Singleton.make(
    "telemetry.gauges",
    Effect.gen(function*() {
      const gauges = yield* TelemetryGauges
      const logged = (effect: Effect.Effect<void>) =>
        effect.pipe(Effect.catchCause((cause) => Effect.logWarning("Telemetry gauges failed", cause)))
      yield* Effect.forkScoped(logged(gauges.sampleHourly).pipe(Effect.repeat(Schedule.spaced("1 hour"))))
      yield* logged(gauges.sample).pipe(Effect.repeat(Schedule.spaced("1 minute")))
    })
  )
}
