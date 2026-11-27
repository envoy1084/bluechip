import { Budget, costMicros, type TokenUsage } from "@bluechip/domain/assistant/Budget"
import { and, eq, sql } from "drizzle-orm"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { Database } from "../../platform/db/Database.ts"
import {
  count,
  LlmBudgetExhausted,
  LlmCost,
  LlmTokens,
  record as recordMetric
} from "../../platform/telemetry/Metrics.ts"
import { Analytics } from "../analytics/Analytics.ts"
import type { AiGeneration } from "../analytics/LlmEvents.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { usageBudgets } from "./tables.ts"

/** What a model call is for. */
type ModelFeature = "chat" | "title" | "memory" | "judgment"

/**
 * What LLM analytics says of a model call beyond its tokens and cost: where it sits in a trace (the current span's
 * when unset), how long it took, why it stopped, and for the assistant its conversation, surface, tools and text.
 */
type ModelCall =
  & Partial<
    Pick<
      AiGeneration,
      | "$ai_trace_id"
      | "$ai_span_id"
      | "$ai_parent_id"
      | "$ai_session_id"
      | "$ai_stop_reason"
      | "$ai_tools"
      | "surface"
      | "agent_id"
      | "$ai_input"
      | "$ai_output_choices"
    >
  >
  & { readonly latencyMs?: number | undefined }

/**
 * Each user's assistant spend per UTC day, against `ASSISTANT_DAILY_BUDGET` dollars: every model call is recorded,
 * and a spent day stops the model until midnight UTC.
 */
export class Budgets extends Context.Service<Budgets, {
  readonly today: (owner: Owner) => Effect.Effect<Budget>
  /**
   * Adds a call's tokens and cost to today's spend; `feature` is what the call was for, in the models' metrics. Tells
   * LLM analytics of the call (`$ai_generation`, with `call`'s details) once it is counted.
   */
  readonly record: (
    owner: Owner,
    model: string,
    usage: TokenUsage,
    feature: ModelFeature,
    call?: ModelCall
  ) => Effect.Effect<Budget>
}>()("@bluechip/server/Budgets") {
  static readonly layer = Layer.effect(
    Budgets,
    Effect.gen(function*() {
      const db = yield* Database
      const analytics = yield* Analytics
      const dollars = yield* Config.Number("ASSISTANT_DAILY_BUDGET").pipe(Config.withDefault(1))
      const limitMicros = Math.round(dollars * 1_000_000)

      const budgetOf = (day: string, row: typeof usageBudgets.$inferSelect | undefined) =>
        new Budget({
          day,
          inputTokens: row?.inputTokens ?? 0,
          outputTokens: row?.outputTokens ?? 0,
          costMicros: row?.costMicros ?? 0,
          limitMicros
        })

      const today = Effect.fn("Budgets.today")(function*(owner: Owner) {
        const day = DateTime.formatIsoDateUtc(yield* DateTime.now)
        const [row] = yield* db.select().from(usageBudgets).where(and(
          eq(usageBudgets.userId, owner.id as `user_${string}`),
          eq(usageBudgets.day, day)
        )).pipe(Effect.orDie)
        return budgetOf(day, row)
      })

      const record = Effect.fn("Budgets.record")(function*(
        owner: Owner,
        model: string,
        usage: TokenUsage,
        feature: ModelFeature,
        call: ModelCall = {}
      ) {
        const day = DateTime.formatIsoDateUtc(yield* DateTime.now)
        const input = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
        const cost = costMicros(model, usage)

        const [row] = yield* db.insert(usageBudgets).values({
          userId: owner.id as `user_${string}`,
          day,
          inputTokens: input,
          outputTokens: usage.outputTokens,
          costMicros: cost
        }).onConflictDoUpdate({
          target: [usageBudgets.userId, usageBudgets.day],
          set: {
            inputTokens: sql`${usageBudgets.inputTokens} + ${input}`,
            outputTokens: sql`${usageBudgets.outputTokens} + ${usage.outputTokens}`,
            costMicros: sql`${usageBudgets.costMicros} + ${cost}`
          }
        }).returning().pipe(Effect.orDie)

        for (
          const [kind, tokens] of [
            ["input", usage.inputTokens],
            ["output", usage.outputTokens],
            ["cache_read", usage.cacheReadTokens],
            ["cache_write", usage.cacheWriteTokens]
          ] as const
        ) {
          if (tokens > 0) yield* recordMetric(LlmTokens, tokens, { model, feature, kind })
        }
        yield* recordMetric(LlmCost, cost / 1_000_000, { model, feature })
        // The call that spent the day's budget, once per person and day.
        if (row!.costMicros >= limitMicros && row!.costMicros - cost < limitMicros) yield* count(LlmBudgetExhausted, {})

        const span = yield* Effect.option(Effect.currentSpan)
        const spanId = call.$ai_span_id ?? (Option.isSome(span) ? span.value.spanId : crypto.randomUUID())
        const { $ai_input, $ai_output_choices, latencyMs, ...known } = call
        yield* analytics.capture(owner.id, {
          _tag: "$ai_generation",
          $ai_trace_id: Option.isSome(span) ? span.value.traceId : spanId,
          $ai_span_name: feature,
          $ai_model: model,
          $ai_provider: "anthropic",
          $ai_input_tokens: usage.inputTokens,
          $ai_output_tokens: usage.outputTokens,
          $ai_cache_read_input_tokens: usage.cacheReadTokens,
          $ai_cache_creation_input_tokens: usage.cacheWriteTokens,
          $ai_is_error: false,
          $ai_total_cost_usd: cost / 1_000_000,
          ...(latencyMs === undefined ? {} : { $ai_latency: latencyMs / 1000 }),
          ...known,
          $ai_span_id: spanId,
          ...(analytics.capturesText ? { $ai_input, $ai_output_choices } : {})
        }, { id: spanId })
        return budgetOf(day, row)
      })

      return Budgets.of({ today, record })
    })
  )
}
