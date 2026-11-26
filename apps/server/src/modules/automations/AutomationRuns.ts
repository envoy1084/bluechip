import type { JudgmentAnswer, JudgmentPreset } from "@bluechip/domain/automations/conditions/Judgment"
import type { ConditionRecord, RunOutcome, TriggerData } from "@bluechip/domain/automations/Run"
import { AutomationRun, Judgment } from "@bluechip/domain/automations/Run"
import {
  type AgentId,
  type AutomationId,
  type AutomationRunId,
  IntentId,
  type JudgmentId,
  type NewsItemId,
  type UserId
} from "@bluechip/domain/Ids"
import { journalOfJudgment, journalOfRun } from "@bluechip/domain/journal/Journal"
import { and, desc, eq, inArray } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { AgentJournal } from "../journal/AgentJournal.ts"
import { automationRuns, automations, judgments } from "./tables.ts"

export type RunRow = typeof automationRuns.$inferSelect

const toRun = (row: RunRow): AutomationRun =>
  new AutomationRun({
    id: row.id as AutomationRunId,
    automationId: row.automationId as AutomationId,
    windowKey: row.windowKey,
    firedAt: row.firedAt,
    trigger: row.triggerData,
    conditions: row.conditions,
    // A run still going reads as proposed: its intents are on their way.
    outcome: row.outcome === "running" ? "proposed" : row.outcome,
    reason: row.reason,
    intentIds: row.intentIds.map((id) => IntentId.make(id))
  })

const toJudgment = (row: typeof judgments.$inferSelect): Judgment =>
  new Judgment({
    id: row.id as JudgmentId,
    runId: row.runId as AutomationRunId,
    preset: row.preset,
    inputs: { newsItemId: row.newsItemId as NewsItemId | null, headline: row.headline },
    model: row.model,
    answer: row.answer,
    at: row.at
  })

// The runs an automation's detail shows.
const LATEST_RUNS = 20

/**
 * Each fire of an automation, once per window: started when its trigger fires (`start` returns the run already made
 * for that window), then ended with its conditions' results, its outcome and the intents it proposed; and the
 * judgments a model answered on the way. An agent's runs and judgments go into its journal.
 */
export class AutomationRuns extends Context.Service<AutomationRuns, {
  /** The run for this window, made now (`created`) or earlier. */
  readonly start: (input: {
    readonly automationId: string
    readonly userId: string
    readonly windowKey: string
    readonly trigger: TriggerData
  }) => Effect.Effect<{ readonly row: RunRow; readonly created: boolean }>
  readonly get: (id: string) => Effect.Effect<RunRow | undefined>
  /** Ends a run. */
  readonly finish: (id: string, result: {
    readonly outcome: RunOutcome
    readonly reason: string
    readonly conditions: ReadonlyArray<ConditionRecord>
    readonly intentIds: ReadonlyArray<string>
  }) => Effect.Effect<RunRow>
  /** Logs a model's answer to a judgment of a run. */
  readonly judged: (input: {
    readonly runId: string
    readonly preset: JudgmentPreset
    readonly newsItemId: string | null
    readonly headline: string
    readonly model: string
    readonly answer: JudgmentAnswer
  }) => Effect.Effect<JudgmentId>
  /** An automation's latest runs, newest first, and their judgments. */
  readonly ofAutomation: (automationId: string) => Effect.Effect<{
    readonly runs: ReadonlyArray<AutomationRun>
    readonly judgments: ReadonlyArray<Judgment>
  }>
}>()("@bluechip/server/AutomationRuns") {
  static readonly layer = Layer.effect(
    AutomationRuns,
    Effect.gen(function*() {
      const db = yield* Database
      const journal = yield* AgentJournal

      // The agent's automation a run belongs to, when it trades for an agent.
      const agentAutomationOf = Effect.fnUntraced(function*(runId: string) {
        const [found] = yield* db.select({
          automationId: automations.id,
          name: automations.name,
          agentId: automations.agentId,
          userId: automations.userId
        }).from(automationRuns).innerJoin(automations, eq(automations.id, automationRuns.automationId))
          .where(eq(automationRuns.id, runId as `run_${string}`)).pipe(Effect.orDie)
        return found?.agentId === null ? undefined : found
      })

      const start = Effect.fn("AutomationRuns.start")(function*(input: {
        readonly automationId: string
        readonly userId: string
        readonly windowKey: string
        readonly trigger: TriggerData
      }) {
        const [created] = yield* db.insert(automationRuns).values({
          id: typeid("run").toString() as `run_${string}`,
          automationId: input.automationId as `automation_${string}`,
          userId: input.userId as `user_${string}`,
          windowKey: input.windowKey,
          firedAt: yield* DateTime.now,
          triggerData: input.trigger,
          conditions: [],
          outcome: "running",
          reason: "Running.",
          intentIds: []
        }).onConflictDoNothing().returning().pipe(Effect.orDie)
        if (created !== undefined) return { row: created, created: true }

        const [existing] = yield* db.select().from(automationRuns).where(and(
          eq(automationRuns.automationId, input.automationId as `automation_${string}`),
          eq(automationRuns.windowKey, input.windowKey)
        )).pipe(Effect.orDie)
        return { row: existing!, created: false }
      })

      const get = Effect.fn("AutomationRuns.get")(function*(id: string) {
        const [row] = yield* db.select().from(automationRuns).where(eq(automationRuns.id, id as `run_${string}`))
          .pipe(Effect.orDie)
        return row
      })

      const finish = Effect.fn("AutomationRuns.finish")(function*(id: string, result: {
        readonly outcome: RunOutcome
        readonly reason: string
        readonly conditions: ReadonlyArray<ConditionRecord>
        readonly intentIds: ReadonlyArray<string>
      }) {
        const [row] = yield* db.update(automationRuns).set({
          outcome: result.outcome,
          reason: result.reason,
          conditions: result.conditions,
          intentIds: [...result.intentIds]
        }).where(eq(automationRuns.id, id as `run_${string}`)).returning().pipe(Effect.orDie)

        const automation = yield* agentAutomationOf(id)
        if (automation !== undefined) {
          yield* journal.write({
            userId: automation.userId as UserId,
            agentId: automation.agentId as AgentId,
            kind: "automation",
            entry: journalOfRun({ automationName: automation.name, outcome: result.outcome, reason: result.reason }),
            refs: { automationId: automation.automationId as AutomationId, runId: id as AutomationRunId }
          })
        }
        return row!
      })

      const judged = Effect.fn("AutomationRuns.judged")(function*(input: {
        readonly runId: string
        readonly preset: JudgmentPreset
        readonly newsItemId: string | null
        readonly headline: string
        readonly model: string
        readonly answer: JudgmentAnswer
      }) {
        const id = typeid("judgment").toString() as `judgment_${string}`
        yield* db.insert(judgments).values({
          id,
          runId: input.runId as `run_${string}`,
          preset: input.preset,
          newsItemId: input.newsItemId as `news_${string}` | null,
          headline: input.headline,
          model: input.model,
          answer: input.answer,
          at: yield* DateTime.now
        }).pipe(Effect.orDie)

        const automation = yield* agentAutomationOf(input.runId)
        if (automation !== undefined) {
          yield* journal.write({
            userId: automation.userId as UserId,
            agentId: automation.agentId as AgentId,
            kind: "judgment",
            entry: journalOfJudgment({
              automationName: automation.name,
              headline: input.headline,
              answer: input.answer
            }),
            refs: {
              automationId: automation.automationId as AutomationId,
              runId: input.runId as AutomationRunId,
              judgmentId: id as JudgmentId
            }
          })
        }
        return id as JudgmentId
      })

      const ofAutomation = Effect.fn("AutomationRuns.ofAutomation")(function*(automationId: string) {
        const rows = yield* db.select().from(automationRuns)
          .where(eq(automationRuns.automationId, automationId as `automation_${string}`))
          .orderBy(desc(automationRuns.id)).limit(LATEST_RUNS).pipe(Effect.orDie)
        const answered = rows.length === 0 ? [] : yield* db.select().from(judgments)
          .where(inArray(judgments.runId, rows.map((row) => row.id))).orderBy(desc(judgments.id)).pipe(Effect.orDie)
        return { runs: rows.map(toRun), judgments: answered.map(toJudgment) }
      })

      return AutomationRuns.of({ start, get, finish, judged, ofAutomation })
    })
  )
}
