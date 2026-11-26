/**
 * An agent's journal: what it did and why, written by bluechip from what happened (its intents, their fills and
 * refusals, your approvals, its automations' runs and judgments), never by a model, so every entry is exact.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import type { JudgmentAnswer } from "../automations/conditions/Judgment.ts"
import type { RunOutcome } from "../automations/Run.ts"
import { AgentId, AutomationId, AutomationRunId, IntentId, JournalEntryId, JudgmentId } from "../Ids.ts"
import { describeDecision, describeLeg } from "../intents/Describe.ts"
import type { Intent } from "../intents/Intent.ts"
import type { StockSymbol } from "../market/Market.ts"

/**
 * What an entry is about: one of the agent's trades, a run of one of its automations, or a model's judgment in one.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const JournalKind = Schema.Literals(["intent", "automation", "judgment"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type JournalKind = typeof JournalKind.Type

/**
 * The records an entry points at.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const JournalRefs = Schema.Struct({
  intentId: Schema.optionalKey(IntentId),
  automationId: Schema.optionalKey(AutomationId),
  runId: Schema.optionalKey(AutomationRunId),
  judgmentId: Schema.optionalKey(JudgmentId)
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type JournalRefs = typeof JournalRefs.Type

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class JournalEntry extends Schema.Class<JournalEntry>("@bluechip/domain/journal/Journal/JournalEntry")({
  id: JournalEntryId,
  agentId: AgentId,
  at: Schema.DateTimeUtc,
  kind: JournalKind,
  /** What happened, in words. */
  entry: Schema.String,
  refs: JournalRefs
}) {}

/**
 * The entry for an agent's intent reaching `intent.status`, or `undefined` for steps on the way (proposed, deciding,
 * confirming, and sending a trade you approved) that say nothing new. A decision carries the intent's reason.
 *
 * **Example** (A refusal)
 *
 * ```ts import.meta.vitest
 * import { journalOfIntent } from "@bluechip/domain/journal/Journal"
 *
 * journalOfIntent({
 *   status: "blocked",
 *   leg: { symbol: "TSLA", side: "buy", amount: { usdc: 50_000_000n } },
 *   reason: "Momentum.",
 *   decision: { _tag: "Refused", policy: "trade", message: "It doesn't trade Tesla." }
 * } as never, () => "Tesla")
 * // => "Buy $50.00 of Tesla, blocked by Stocks and direction: It doesn't trade Tesla. Why: Momentum."
 * ```
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const journalOfIntent = (
  intent: Pick<Intent, "status" | "leg" | "reason" | "decision">,
  name: (symbol: StockSymbol) => string
): string | undefined => {
  const trade = describeLeg(intent.leg, name)
  const why = `Why: ${intent.reason}`
  const decided = intent.decision === null ? "" : describeDecision(intent.decision)

  switch (intent.status) {
    case "proposed":
    case "deciding":
    case "confirming":
      return undefined
    case "sending":
      // An approved trade is sent with your passkey, not by the agent: its approval already said so.
      return intent.decision?._tag === "Passes" ? `${trade}, sent within its policies. ${why}` : undefined
    case "needsApproval":
    case "waiting":
      return `${trade}. ${decided} ${why}`
    case "blocked":
      return `${trade}, ${decided.charAt(0).toLowerCase()}${decided.slice(1)} ${why}`
    case "awaitingSignature":
      return `${trade}: you approved it, and it waits for your Face ID.`
    case "filled":
      return `${trade}: filled.`
    case "failed":
      return `${trade}: failed onchain, nothing was traded.`
    case "declined":
      return `${trade}: you declined it.`
    case "expired":
      return `${trade}: expired before it was answered.`
    case "cancelled":
      return `${trade}: cancelled before it was sent.`
  }
}

const OUTCOMES: Readonly<Record<RunOutcome, string>> = {
  proposed: "proposed trades",
  asked: "asked you first",
  notified: "let you know",
  skipped: "skipped",
  failed: "failed"
}

/**
 * The entry for a run of one of the agent's automations.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const journalOfRun = (run: {
  readonly automationName: string
  readonly outcome: RunOutcome
  readonly reason: string
}): string => `Automation "${run.automationName}" ${OUTCOMES[run.outcome]}: ${run.reason}`

/**
 * The entry for a model's judgment in one of the agent's automations.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const journalOfJudgment = (judgment: {
  readonly automationName: string
  readonly headline: string
  readonly answer: JudgmentAnswer
}): string =>
  `Automation "${judgment.automationName}" judged "${judgment.headline}": ` +
  `${judgment.answer.verdict ? "yes" : "no"}, ${Math.round(judgment.answer.confidence * 100)}% sure. ` +
  judgment.answer.reason
