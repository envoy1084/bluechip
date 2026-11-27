/**
 * What an automation did: each run (one fire of its trigger, once per window) with what fired it, each condition's
 * result and reason, and how it ended; the judgments a model answered on the way; and the news stories it read.
 *
 * @since 0.0.0
 */
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { AutomationId, AutomationRunId, IntentId, JudgmentId, NewsItemId } from "../Ids.ts"
import { type Intent, isEnded } from "../intents/Intent.ts"
import { StockSymbol } from "../market/Market.ts"
import { Price } from "../market/Units.ts"
import { PolicyId } from "../policies/AgentSpec.ts"
import { Automation } from "./Automation.ts"
import { JudgmentAnswer, JudgmentPreset } from "./conditions/Judgment.ts"

/**
 * What fired it, in words ("NVIDIA at $90, 10% under its $100 high"), with the stock, its price and the story when
 * there was one.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TriggerData = Schema.Struct({
  summary: Schema.String,
  symbol: Schema.NullOr(StockSymbol),
  price: Schema.NullOr(Price),
  newsItemId: Schema.NullOr(NewsItemId)
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TriggerData = typeof TriggerData.Type

/**
 * One condition's result, with the judgment that decided it when a model did.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ConditionRecord = Schema.Struct({
  type: Schema.String,
  pass: Schema.Boolean,
  reason: Schema.String,
  judgmentId: Schema.NullOr(JudgmentId)
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type ConditionRecord = typeof ConditionRecord.Type

/**
 * How a run ended: trades proposed (to the agent's policies), trades waiting for your approval (`asked`), a message
 * for you (`notified`), skipped (a condition failed, a setting held it back, nothing to trade), or failed.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const RunOutcome = Schema.Literals(["proposed", "asked", "notified", "skipped", "failed"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type RunOutcome = typeof RunOutcome.Type

/**
 * What a run came to once its trades were decided: every trade filled (`traded`), some filled and some not
 * (`partlyTraded`), none filled because a policy blocked them (`blocked`) or for another reason (`notTraded`: failed
 * onchain, declined, expired, cancelled), trades still on their way (`working`), or waiting for your Face ID
 * (`asked`); a run that proposed nothing keeps its outcome (`notified`, `skipped`, `failed`).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const RunResult = Schema.Literals([
  "traded",
  "partlyTraded",
  "blocked",
  "notTraded",
  "working",
  "asked",
  "notified",
  "skipped",
  "failed"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type RunResult = typeof RunResult.Type

/**
 * What a run came to from its outcome and where its trades are now, with the policies that blocked any of them.
 *
 * **Example** (A run whose two trades a policy blocked)
 *
 * ```ts import.meta.vitest
 * import { runResultOf } from "@bluechip/domain/automations/Run"
 *
 * const refused = { _tag: "Refused", policy: "tradeSize", error: null, stock: null, message: "Over budget" } as const
 * runResultOf("proposed", [{ status: "blocked", decision: refused }, { status: "blocked", decision: refused }])
 * // => { result: "blocked", blockedBy: ["tradeSize"] }
 * ```
 *
 * @stability unstable
 * @category results
 * @since 0.0.0
 */
export const runResultOf = (
  outcome: RunOutcome,
  trades: ReadonlyArray<Pick<Intent, "status" | "decision">>
): { readonly result: RunResult; readonly blockedBy: ReadonlyArray<PolicyId> } => {
  const blockedBy = [
    ...new Set(trades.flatMap((trade) => trade.decision?._tag === "Refused" ? [trade.decision.policy] : []))
  ]
  if (outcome === "notified" || outcome === "skipped" || outcome === "failed") return { result: outcome, blockedBy }
  if (trades.some((trade) => trade.status === "needsApproval" || trade.status === "awaitingSignature")) {
    return { result: "asked", blockedBy }
  }
  if (trades.length === 0 || trades.some((trade) => !isEnded(trade.status))) {
    return { result: outcome === "asked" ? "asked" : "working", blockedBy }
  }

  const filled = trades.filter((trade) => trade.status === "filled").length
  if (filled === trades.length) return { result: "traded", blockedBy }
  if (filled > 0) return { result: "partlyTraded", blockedBy }
  return { result: trades.some((trade) => trade.status === "blocked") ? "blocked" : "notTraded", blockedBy }
}

/**
 * One fire of an automation.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AutomationRun extends Schema.Class<AutomationRun>("@bluechip/domain/automations/Run/AutomationRun")({
  id: AutomationRunId,
  automationId: AutomationId,
  /** The window it fired for; a window fires once. */
  windowKey: Schema.String,
  firedAt: Schema.DateTimeUtc,
  trigger: TriggerData,
  conditions: Schema.Array(ConditionRecord),
  outcome: RunOutcome,
  /** Why it ended as it did, in a sentence. */
  reason: Schema.String,
  intentIds: Schema.Array(IntentId),
  // Defaults read the runs the notifications' outbox stored before runs carried their result: drafts read `outcome`.
  /** What its trades came to, as they stand now (`runResultOf`). */
  result: RunResult.pipe(Schema.withDecodingDefaultTypeKey(Effect.succeed("working" as const))),
  /** The policies that blocked any of its trades. */
  blockedBy: Schema.Array(PolicyId).pipe(Schema.withDecodingDefaultTypeKey(Effect.succeed([])))
}) {}

/**
 * One typed question a model answered during a run: the question, what it read (untrusted), the model, its answer.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Judgment extends Schema.Class<Judgment>("@bluechip/domain/automations/Run/Judgment")({
  id: JudgmentId,
  runId: AutomationRunId,
  preset: JudgmentPreset,
  inputs: Schema.Struct({ newsItemId: Schema.NullOr(NewsItemId), headline: Schema.String }),
  model: Schema.String,
  answer: JudgmentAnswer,
  at: Schema.DateTimeUtc
}) {}

/**
 * An automation with its latest runs (newest first) and their judgments.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AutomationDetail
  extends Schema.Class<AutomationDetail>("@bluechip/domain/automations/Run/AutomationDetail")({
    automation: Automation,
    runs: Schema.Array(AutomationRun),
    judgments: Schema.Array(Judgment)
  })
{}

/**
 * A news story bluechip read: where it came from, the stocks it is about, its headline and summary (untrusted text).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class NewsItem extends Schema.Class<NewsItem>("@bluechip/domain/automations/Run/NewsItem")({
  id: NewsItemId,
  source: Schema.String,
  symbols: Schema.Array(Schema.String),
  headline: Schema.String,
  summary: Schema.String,
  url: Schema.NullOr(Schema.String),
  publishedAt: Schema.DateTimeUtc
}) {}
