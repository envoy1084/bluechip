import { actionOf, asksFirst, conditionOf, triggerOf } from "@bluechip/domain/automations/Automation"
import type { Facts } from "@bluechip/domain/automations/Condition"
import type { JudgmentConfig } from "@bluechip/domain/automations/conditions/Judgment"
import { planLegs } from "@bluechip/domain/automations/Planner"
import type { ConditionRecord, RunOutcome, TriggerData } from "@bluechip/domain/automations/Run"
import { gate, type SkipReason } from "@bluechip/domain/automations/Settings"
import type { UserId } from "@bluechip/domain/Ids"
import { waves } from "@bluechip/domain/intents/Batch"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Price, Shares } from "@bluechip/domain/market/Units"
import { complete } from "@bluechip/domain/policies/Catalog"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Address } from "viem"
import { AutomationsRuns, AutomationsSkipped, BatchesCreated, count } from "../../platform/telemetry/Metrics.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { AgentStore } from "../agents/AgentStore.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { Intents } from "../intents/Intents.ts"
import { marketStatus } from "../market/Calendar.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { valueHoldings } from "../portfolio/Valuation.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { AutomationRuns } from "./AutomationRuns.ts"
import { type AutomationRow, Automations } from "./Automations.ts"
import { Judgments } from "./Judgments.ts"
import { NewsItems } from "./NewsItems.ts"

// A plan's size as the batch metrics group it: 1, 2–3, 4–6, 7+.
const sizeBucket = (size: number) => size <= 1 ? "1" : size <= 3 ? "2-3" : size <= 6 ? "4-6" : "7+"

const SKIPPED: Readonly<Record<SkipReason, string>> = {
  inactive: "It isn't active.",
  cooldown: "It fired less than its cooldown ago.",
  quietHours: "It is in its quiet hours.",
  marketClosed: "The market is closed.",
  done: "It already fired as often as it may.",
  expired: "It has expired."
}

// A market price older than this, while regular trading is on, is stale.
const FRESH = Duration.minutes(20)

const trades = (count: number) => `${count} ${count === 1 ? "trade" : "trades"}`

/**
 * One fire of an automation, for a window: settings and the agent first, then the conditions in order (judgments
 * asked and logged), then the action's legs, proposed as intents through the account's desk (each once, keyed by the
 * window and its place), and the run recorded with why it ended as it did. Running it again for the same window
 * (after a restart) finishes the run already started and proposes nothing twice.
 */
export class AutomationRunner extends Context.Service<AutomationRunner, {
  readonly fire: (automationId: string, windowKey: string, trigger: TriggerData) => Effect.Effect<void>
}>()("@bluechip/server/AutomationRunner") {
  static readonly layer = Layer.effect(
    AutomationRunner,
    Effect.gen(function*() {
      const automations = yield* Automations
      const runs = yield* AutomationRuns
      const analytics = yield* Analytics
      const agentStore = yield* AgentStore
      const accounts = yield* Accounts
      const balances = yield* AccountBalances
      const market = yield* MarketPrices
      const intents = yield* Intents
      const judgments = yield* Judgments
      const news = yield* NewsItems

      // The conditions in order, stopping at the first that fails.
      const evaluate = Effect.fnUntraced(function*(
        row: AutomationRow,
        owner: Owner,
        runId: string,
        facts: Facts,
        trigger: TriggerData
      ) {
        const records: Array<ConditionRecord> = []
        for (const entry of row.conditions) {
          if (entry.type === "judgment") {
            const story = trigger.newsItemId === null ? undefined : yield* news.get(trigger.newsItemId)
            const result = yield* judgments.judge(owner, runId, entry.config as JudgmentConfig, story)
            records.push({ type: entry.type, ...result })
          } else {
            const result = conditionOf(entry).evaluate!(entry.config, facts)
            records.push({ type: entry.type, ...result, judgmentId: null })
          }
          if (!records.at(-1)!.pass) break
        }
        return records
      })

      const run = Effect.fnUntraced(function*(row: AutomationRow, runId: string, trigger: TriggerData) {
        const now = yield* DateTime.now
        const status = marketStatus(now)
        const marketOpen = status.session === "regular"

        const skipped = gate(row.settings, {
          active: row.status === "active",
          fires: row.fires,
          lastFiredAt: row.lastFiredAt,
          now,
          marketOpen,
          marketHours: triggerOf(row.trigger).marketHours
        })
        if (skipped === "done" || skipped === "expired") yield* automations.end(row.id, skipped)
        if (skipped !== null) {
          return { outcome: "skipped" as RunOutcome, reason: SKIPPED[skipped], conditions: [], intentIds: [] }
        }

        const tradingState = row.agentId === null ? undefined : yield* agentStore.tradingState(row.agentId)
        if (tradingState !== undefined && !tradingState.canTrade) {
          return {
            outcome: "skipped" as RunOutcome,
            reason: "Its agent is paused or can't trade.",
            conditions: [],
            intentIds: []
          }
        }

        const owner: Owner = {
          id: row.userId as UserId,
          account: (yield* accounts.me(row.userId as UserId)).account.address
        }
        const holdings = yield* balances.of(owner.account as Address)
        const prices = yield* market.prices
        const facts: Facts = {
          now,
          marketOpen,
          pricesFresh: prices.size > 0 &&
            (!marketOpen ||
              [...prices.values()].every((price) =>
                Duration.isLessThanOrEqualTo(DateTime.distance(price.tradedAt, now), FRESH)
              )),
          prices: new Map([...prices].map(([symbol, price]) => [symbol, price.price as Price])),
          holdings: new Map(
            [...holdings].filter(([symbol]) => symbol !== "USDC").map(([symbol, shares]) => [
              symbol as StockSymbol,
              shares as Shares
            ])
          )
        }

        const conditions = yield* evaluate(row, owner, runId, facts, trigger)
        const failed = conditions.find((record) => !record.pass)
        if (failed !== undefined) {
          return { outcome: "skipped" as RunOutcome, reason: failed.reason, conditions, intentIds: [] }
        }

        if (actionOf(row.action).plan === null) {
          const message = row.action.type === "notify" ? row.action.config.message.trim() : ""
          return {
            outcome: "notified" as RunOutcome,
            reason: message === "" ? `${trigger.summary}.` : message,
            conditions,
            intentIds: []
          }
        }

        // Your own trades always ask you (your Face ID signs them); an agent's ask when the automation does.
        const asking = row.agentId === null || asksFirst(row)
        const spec = tradingState?.session === undefined ? null : complete(tradingState.session.spec)
        const legs = planLegs(row.action, {
          portfolio: valueHoldings(holdings, prices, now),
          prices: facts.prices,
          spec
        }, asking)
        if (legs.length === 0) {
          return { outcome: "skipped" as RunOutcome, reason: "There was nothing to trade.", conditions, intentIds: [] }
        }

        // Several legs are one plan (the run's), sent wave by wave: each wave in one operation, or one approval.
        const operations = waves(legs)
        if (legs.length > 1) {
          yield* count(BatchesCreated, { legs: sizeBucket(legs.length), waves: sizeBucket(operations.length) })
        }
        const proposed: Array<Intent> = []
        for (const [wave, operation] of operations.entries()) {
          for (const leg of operation) {
            const index = proposed.length
            proposed.push(
              yield* intents.propose(owner, {
                requestId: `${runId}:${index}`,
                dedupeKey: `automation:${runId}:${index}`,
                agentId: row.agentId as never,
                leg,
                reason: `${row.name}: ${trigger.summary}`,
                source: "automation",
                sourceId: runId,
                ask: asking,
                batch: legs.length > 1 ? { id: runId, wave } : undefined
              })
            )
          }
        }
        return {
          outcome: (asking ? "asked" : "proposed") as RunOutcome,
          reason: asking ? `Asked you about ${trades(legs.length)}.` : `Proposed ${trades(legs.length)}.`,
          conditions,
          intentIds: proposed.map((intent) => intent.id as string)
        }
      })

      const fire = Effect.fn("AutomationRunner.fire")(function*(
        automationId: string,
        windowKey: string,
        trigger: TriggerData
      ) {
        yield* Effect.annotateCurrentSpan("automation.id", automationId)
        const row = yield* automations.get(automationId)
        if (row === undefined) return
        yield* Effect.annotateCurrentSpan({
          "user.id": row.userId,
          ...(row.agentId === null ? {} : { "agent.id": row.agentId })
        })

        const started = yield* runs.start({ automationId, userId: row.userId, windowKey, trigger })
        if (started.row.outcome !== "running") return

        // A failed run's reason is read after the fact, maybe once the automation has ended: it says what went
        // wrong, never that it will try again.
        const failed = (reason: string) => (cause: unknown) =>
          Effect.logWarning(`Automation ${automationId} failed to run`, cause).pipe(
            Effect.as({ outcome: "failed" as RunOutcome, reason, conditions: [], intentIds: [] })
          )
        const result = yield* run(row, started.row.id, trigger).pipe(
          Effect.catchTag("ChainError", failed("It couldn't read your balances just then, so nothing was traded.")),
          Effect.catchCause(failed("Something went wrong on bluechip's side, so nothing was traded."))
        )
        yield* runs.finish(started.row.id, result)
        yield* count(AutomationsRuns, { trigger: row.trigger.type, action: row.action.type, outcome: result.outcome })
        const stopped = result.conditions.find((condition) => !condition.pass)
        if (stopped !== undefined) yield* count(AutomationsSkipped, { condition: stopped.type })
        // The run is the fact: a fire replayed after a restart finds it started and tells nothing again.
        const userId = row.userId as UserId
        const fact = { id: started.row.id, at: started.row.firedAt }
        if (result.outcome === "skipped") {
          yield* analytics.capture(userId, {
            _tag: "automation_skipped",
            trigger: row.trigger.type,
            condition: stopped?.type ?? "nothing_to_trade"
          }, fact)
        } else {
          yield* analytics.capture(userId, {
            _tag: "automation_fired",
            trigger: row.trigger.type,
            action: row.action.type,
            outcome: result.outcome === "proposed"
              ? "traded"
              : result.outcome === "asked"
              ? "proposed"
              : result.outcome,
            legs: result.intentIds.length
          }, fact)
        }
        if (result.outcome === "skipped" || result.outcome === "failed") return

        yield* automations.fired(row.id, yield* DateTime.now)
        const { maxFires } = row.settings
        if (maxFires !== null && row.fires + 1 >= maxFires) yield* automations.end(row.id, "done")
      })

      return AutomationRunner.of({ fire })
    })
  )
}
