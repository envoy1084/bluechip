/**
 * What an automation did: each run (one fire of its trigger, once per window) with what fired it, each condition's
 * result and reason, and how it ended; the judgments a model answered on the way; and the news stories it read.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { AutomationId, AutomationRunId, IntentId, JudgmentId, NewsItemId } from "../Ids.ts"
import { StockSymbol } from "../market/Market.ts"
import { Price } from "../market/Units.ts"
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
  intentIds: Schema.Array(IntentId)
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
