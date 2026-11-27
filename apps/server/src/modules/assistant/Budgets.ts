import { Budget, costMicros, type TokenUsage } from "@bluechip/domain/assistant/Budget"
import { and, eq, sql } from "drizzle-orm"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Database } from "../../platform/db/Database.ts"
import {
  count,
  LlmBudgetExhausted,
  LlmCost,
  LlmTokens,
  record as recordMetric
} from "../../platform/telemetry/Metrics.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { usageBudgets } from "./tables.ts"

/** What a model call is for. */
export type ModelFeature = "chat" | "title" | "memory" | "judgment"

/**
 * Each user's assistant spend per UTC day, against `ASSISTANT_DAILY_BUDGET` dollars: every model call is recorded,
 * and a spent day stops the model until midnight UTC.
 */
export class Budgets extends Context.Service<Budgets, {
  readonly today: (owner: Owner) => Effect.Effect<Budget>
  /** Adds a call's tokens and cost to today's spend; `feature` is what the call was for, in the models' metrics. */
  readonly record: (owner: Owner, model: string, usage: TokenUsage, feature: ModelFeature) => Effect.Effect<Budget>
}>()("@bluechip/server/Budgets") {
  static readonly layer = Layer.effect(
    Budgets,
    Effect.gen(function*() {
      const db = yield* Database
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
        feature: ModelFeature
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
        return budgetOf(day, row)
      })

      return Budgets.of({ today, record })
    })
  )
}
