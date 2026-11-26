// What a preview automation's runs say: what fired it (in the watchers' words), each condition's result (a judgment's
// by the domain's own `judged`), and how it ended (in the runner's words), for any outcome the panel picks.
import type { Condition } from "@bluechip/domain/automations/Automation"
import { judged, type JudgmentAnswer } from "@bluechip/domain/automations/conditions/Judgment"
import {
  AutomationRun,
  type ConditionRecord,
  Judgment,
  type RunOutcome,
  type TriggerData
} from "@bluechip/domain/automations/Run"
import type { SkipReason } from "@bluechip/domain/automations/Settings"
import type { AutomationRunId, JudgmentId, NewsItemId } from "@bluechip/domain/Ids"
import { formatPrice } from "@bluechip/domain/policies/Format"
import * as DateTime from "effect/DateTime"
import { type IdCounter, nextId } from "./AgentRecord.ts"
import { type AutomationRecord, countFires, priceOf } from "./automations.ts"
import { stockName } from "./stockName.ts"

/** Why a skipped run didn't trade: a setting held it back, a condition failed, its agent couldn't, or nothing to. */
export const RUN_SKIPS = [
  { value: "condition", label: "A condition failed" },
  { value: "cooldown", label: "Cooldown" },
  { value: "quietHours", label: "Quiet hours" },
  { value: "marketClosed", label: "Market closed" },
  { value: "agent", label: "Agent can't trade" },
  { value: "nothing", label: "Nothing to trade" }
] as const

export type RunSkip = (typeof RUN_SKIPS)[number]["value"]

const SKIPPED: Readonly<Record<Extract<SkipReason, RunSkip>, string>> = {
  cooldown: "It fired less than its cooldown ago.",
  quietHours: "It is in its quiet hours.",
  marketClosed: "The market is closed."
}

const HEADLINES: ReadonlyArray<string> = [
  "Regulators open a probe into the company's driver-assist claims",
  "Company beats delivery estimates, raises its outlook",
  "Analyst trims price target, citing slower demand in Europe"
]

const ANSWERS: Readonly<Record<"yes" | "no" | "unsure", JudgmentAnswer>> = {
  yes: { verdict: true, confidence: 0.86, reason: "A formal probe can lead to recalls and fines." },
  no: { verdict: false, confidence: 0.78, reason: "Better deliveries are good news, not bad." },
  unsure: { verdict: true, confidence: 0.55, reason: "A smaller target is mildly negative." }
}

const trades = (count: number) => `${count} ${count === 1 ? "trade" : "trades"}`

// What fired it, as its watcher says it.
const triggerData = (ids: IdCounter, record: AutomationRecord, headline: string): TriggerData => {
  const trigger = record.automation.trigger
  switch (trigger.type) {
    case "priceMove":
    case "priceCross": {
      const price = priceOf(trigger.config.symbol, trigger.type === "priceMove" ? 0.89 : 0.86)
      return {
        summary: `${stockName(trigger.config.symbol)} is at ${formatPrice(price)}.`,
        symbol: trigger.config.symbol,
        price,
        newsItemId: null
      }
    }
    case "news":
      return {
        summary: `A story: "${headline}"`,
        symbol: trigger.config.symbols[0] ?? null,
        price: null,
        newsItemId: nextId(ids, "news") as NewsItemId
      }
    case "drift":
      return { summary: "Your mix drifted from its target.", symbol: null, price: null, newsItemId: null }
    case "portfolio":
      return { summary: "Your portfolio crossed its level.", symbol: null, price: null, newsItemId: null }
    case "schedule":
      return { summary: "Its scheduled time came.", symbol: null, price: null, newsItemId: null }
  }
}

// One condition's result in words, held or not.
const conditionReason = (condition: Condition, pass: boolean): string => {
  switch (condition.type) {
    case "marketOpen":
      return pass ? "The market is open." : "The market is closed."
    case "pricesFresh":
      return pass ? "Prices are fresh." : "Prices are stale."
    case "holdingAtLeast":
      return pass ?
        `You hold some ${stockName(condition.config.symbol)}.` :
        `You hold no ${stockName(condition.config.symbol)}.`
    case "priceAbove":
    case "priceBelow":
      return `${stockName(condition.config.symbol)} is at ${formatPrice(priceOf(condition.config.symbol))}.`
    default:
      return pass ? "It held." : "It didn't hold."
  }
}

/**
 * A run ending as `outcome` at `at`, added to its history (newest first) with its judgments; a skipped one says why
 * (`skip`). Its fires are counted again.
 */
export const addRun = (
  ids: IdCounter,
  record: AutomationRecord,
  options: {
    readonly outcome: RunOutcome
    readonly skip?: RunSkip | undefined
    /** How the model answers a judgment in it. */
    readonly answer?: keyof typeof ANSWERS | undefined
    readonly at: DateTime.Utc
    readonly now: DateTime.Utc
  }
): AutomationRun => {
  const id = nextId(ids, "run") as AutomationRunId
  const headline = HEADLINES[ids.next % HEADLINES.length]!
  const trigger = triggerData(ids, record, headline)
  const skip = options.outcome === "skipped" ? options.skip ?? "condition" : undefined
  const gated = skip === "cooldown" || skip === "quietHours" || skip === "marketClosed" || skip === "agent"
  const failing = skip === "condition" ? Math.max(0, record.automation.conditions.length - 1) : -1

  // The conditions in order, up to the first that fails; none when a setting or the agent stopped it first.
  const conditions: Array<ConditionRecord> = []
  const judgments: Array<Judgment> = []
  if (!gated && options.outcome !== "failed") {
    for (const [index, condition] of record.automation.conditions.entries()) {
      const pass = index !== failing
      if (condition.type !== "judgment") {
        conditions.push({ type: condition.type, pass, reason: conditionReason(condition, pass), judgmentId: null })
        continue
      }
      const answer = ANSWERS[pass ? "yes" : options.answer === "unsure" ? "unsure" : "no"]
      const judgment = new Judgment({
        id: nextId(ids, "judgment") as JudgmentId,
        runId: id,
        preset: condition.config.preset,
        inputs: { newsItemId: trigger.newsItemId, headline },
        model: "claude-haiku-4-5",
        answer,
        at: options.at
      })
      judgments.push(judgment)
      conditions.push({ type: condition.type, ...judged(condition.config, answer), judgmentId: judgment.id })
    }
  }

  const action = record.automation.action
  const legs = action.type === "buy" ? action.config.split.length : action.type === "rebalance" ? 3 : 1
  const reason = (() => {
    switch (options.outcome) {
      case "proposed":
        return `Proposed ${trades(legs)}.`
      case "asked":
        return `Asked you about ${
          trades(action.type === "ask" && action.config.trade.type === "rebalance" ? 3 : legs)
        }.`
      case "notified":
        return action.type === "notify" && action.config.message !== "" ? action.config.message : `${trigger.summary}`
      case "failed":
        return "It couldn't run; it will try again on its next fire."
      case "skipped":
        if (skip === "agent") return "Its agent is paused or can't trade."
        if (skip === "nothing" || (skip === "condition" && conditions.length === 0)) {
          return "There was nothing to trade."
        }
        if (skip === "condition") return conditions.at(-1)!.reason
        return SKIPPED[skip!]
    }
  })()

  const run = new AutomationRun({
    id,
    automationId: record.automation.id,
    windowKey: `${record.automation.trigger.type}:${DateTime.formatIso(options.at)}`,
    firedAt: options.at,
    trigger,
    conditions,
    outcome: options.outcome,
    reason,
    intentIds: []
  })
  record.runs = [run, ...record.runs].sort((a, b) =>
    DateTime.toEpochMillis(b.firedAt) - DateTime.toEpochMillis(a.firedAt)
  )
  record.judgments = [...judgments, ...record.judgments]
  countFires(record, options.now)
  return run
}

type Plan = {
  readonly daysAgo: number
  readonly outcome: RunOutcome
  readonly skip?: RunSkip
  readonly answer?: "no" | "unsure"
}

const weekly = (weeks: number, outcome: RunOutcome, offset: number): ReadonlyArray<Plan> =>
  Array.from({ length: weeks }, (_, index) => ({ daysAgo: offset + index * 7, outcome }))

/** The runs a cast automation has had, by its kind and state: every outcome somewhere in the heavy account. */
export const runPlans = (
  kind: "weeklyBuy" | "stopLoss" | "rebalance" | "newsSell" | "priceAlert" | "monthlySplit",
  state: "active" | "paused" | "done" | "failing"
): ReadonlyArray<Plan> => {
  if (state === "done") return [{ daysAgo: 9, outcome: "proposed" }]
  if (state === "failing") {
    return [{ daysAgo: 0.1, outcome: "failed" }, { daysAgo: 7, outcome: "failed" }, ...weekly(3, "proposed", 14)]
  }

  const offset = state === "paused" ? 12 : 0
  switch (kind) {
    case "weeklyBuy":
    case "monthlySplit":
      return [
        ...weekly(2, "proposed", offset + 2),
        { daysAgo: offset + 16, outcome: "skipped", skip: "marketClosed" },
        ...weekly(2, "proposed", offset + 23)
      ]
    case "stopLoss":
      return [
        { daysAgo: offset + 3, outcome: "proposed" },
        { daysAgo: offset + 3.4, outcome: "skipped", skip: "cooldown" },
        { daysAgo: offset + 12, outcome: "skipped", skip: "condition" }
      ]
    case "rebalance":
      return [
        { daysAgo: offset + 0.2, outcome: "asked" },
        { daysAgo: offset + 3, outcome: "skipped", skip: "nothing" },
        { daysAgo: offset + 6, outcome: "skipped", skip: "quietHours" },
        { daysAgo: offset + 9, outcome: "asked" },
        { daysAgo: offset + 15, outcome: "proposed" }
      ]
    case "newsSell":
      return [
        { daysAgo: offset + 4, outcome: "asked" },
        { daysAgo: offset + 6, outcome: "skipped", skip: "condition", answer: "no" },
        { daysAgo: offset + 11, outcome: "skipped", skip: "condition", answer: "unsure" },
        { daysAgo: offset + 13, outcome: "skipped", skip: "agent" }
      ]
    case "priceAlert":
      return [{ daysAgo: offset + 2, outcome: "notified" }, { daysAgo: offset + 13, outcome: "notified" }]
  }
}
