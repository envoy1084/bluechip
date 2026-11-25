/**
 * The assistant's daily budget per user: tokens counted and their cost in micro-dollars, so a busy day stops the model
 * instead of the bill.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"

/**
 * Tokens one model call used, as the provider reports them.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface TokenUsage {
  /** Input tokens read at full price. */
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
}

/**
 * A model's prices in micro-dollars per million tokens.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface ModelPrice {
  readonly input: number
  readonly output: number
  readonly cacheRead: number
  readonly cacheWrite: number
}

/**
 * Anthropic's list prices (cache writes at 1.25× input, reads at 0.1×). A model missing here is charged as Sonnet,
 * the dearest one the assistant uses, so a new id never runs free.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "claude-sonnet-5-5": { input: 2_000_000, output: 10_000_000, cacheRead: 200_000, cacheWrite: 2_500_000 },
  "claude-haiku-5-5": { input: 100_000, output: 500_000, cacheRead: 10_000, cacheWrite: 125_000 }
}

/**
 * What a call cost, in micro-dollars, rounded up so many small calls never round to nothing.
 *
 * **Example** (A thousand tokens each way on Sonnet)
 *
 * ```ts import.meta.vitest
 * import { costMicros } from "@bluechip/domain/assistant/Budget"
 *
 * costMicros("claude-sonnet-5-5", { inputTokens: 1000, outputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0 }) // => 12000
 * ```
 *
 * @stability unstable
 * @category budgets
 * @since 0.0.0
 */
export const costMicros = (model: string, usage: TokenUsage): number => {
  const price = MODEL_PRICES[model] ?? MODEL_PRICES["claude-sonnet-5-5"]!
  const total = usage.inputTokens * price.input +
    usage.outputTokens * price.output +
    usage.cacheReadTokens * price.cacheRead +
    usage.cacheWriteTokens * price.cacheWrite
  return Math.ceil(total / 1_000_000)
}

/**
 * A user's spend today (UTC), against the daily limit.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Budget extends Schema.Class<Budget>("@bluechip/domain/assistant/Budget/Budget")({
  /** The UTC day, `YYYY-MM-DD`. */
  day: Schema.String,
  inputTokens: Schema.Int,
  outputTokens: Schema.Int,
  costMicros: Schema.Int,
  limitMicros: Schema.Int
}) {}

/**
 * Whether the day's spend has reached the limit: the model is not called again until the next UTC day.
 *
 * @stability unstable
 * @category budgets
 * @since 0.0.0
 */
export const isSpent = (budget: Pick<Budget, "costMicros" | "limitMicros">): boolean =>
  budget.costMicros >= budget.limitMicros
