import { stocks } from "@bluechip/chain/Contracts"
import {
  Automation,
  type AutomationDraft,
  checkAutomation,
  describeAutomation,
  TRIGGERS
} from "@bluechip/domain/automations/Automation"
import { AutomationCheck, catalogInfo, type EntryInfo } from "@bluechip/domain/automations/Catalog"
import { AutomationDetail } from "@bluechip/domain/automations/Run"
import { EMPTY_STATE, type Watcher, type WatchState } from "@bluechip/domain/automations/Trigger"
import { nextRun } from "@bluechip/domain/automations/triggers/Schedule"
import { Conflict, InvalidAutomation, NotFound } from "@bluechip/domain/Errors"
import type { AgentId, AutomationId, MessageId, UserId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import { and, desc, eq, inArray, lte, ne, sql } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { Agents } from "../agents/Agents.ts"
import { AuditLog } from "../audit/AuditLog.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { AutomationRuns } from "./AutomationRuns.ts"
import { automations, automationState } from "./tables.ts"

export type AutomationRow = typeof automations.$inferSelect

const nameOf = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol

const toAutomation = (row: AutomationRow): Automation =>
  new Automation({
    id: row.id as AutomationId,
    name: row.name,
    agentId: row.agentId as AgentId | null,
    trigger: row.trigger,
    conditions: row.conditions,
    action: row.action,
    settings: row.settings,
    status: row.status,
    fires: row.fires,
    lastFiredAt: row.lastFiredAt,
    nextRunAt: row.nextRunAt,
    createdBy: row.createdBy,
    createdFrom: row.createdFrom as MessageId | null,
    description: describeAutomation(row, nameOf),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  })

/** Where an automation came from: you, the assistant's card (and its message), or a template with its agent. */
export interface Origin {
  readonly createdBy: AutomationRow["createdBy"]
  readonly createdFrom?: MessageId | null | undefined
}

/**
 * The owner's automations: checked against the catalogs and the agent's policies before they are saved, paused,
 * resumed, edited and deleted; and, for the watchers, the automations each one serves, their remembered state, and
 * what a fire changes (its count, the next scheduled time, an end).
 */
export class Automations extends Context.Service<Automations, {
  readonly catalog: ReadonlyArray<EntryInfo>
  /** Why a draft can't be saved, and what it does in sentences; `NotFound` when its agent isn't the owner's. */
  readonly check: (owner: Owner, draft: AutomationDraft) => Effect.Effect<AutomationCheck, NotFound>
  /** Saves a draft once per request id; `InvalidAutomation` with every problem when it can't run. */
  readonly create: (
    owner: Owner,
    input: { readonly requestId: string; readonly draft: AutomationDraft } & Origin
  ) => Effect.Effect<Automation, InvalidAutomation | NotFound | Conflict>
  /** Pauses, resumes or edits an automation that hasn't ended; its agent stays the same. */
  readonly update: (owner: Owner, id: AutomationId, changes: {
    readonly status?: "active" | "paused" | undefined
    readonly draft?: AutomationDraft | undefined
  }) => Effect.Effect<Automation, InvalidAutomation | NotFound | Conflict>
  readonly remove: (owner: Owner, id: AutomationId) => Effect.Effect<void, NotFound>
  /** The owner's automations not deleted, newest first; only one agent's with `agentId`. */
  readonly list: (owner: Owner, agentId?: AgentId | undefined) => Effect.Effect<ReadonlyArray<Automation>>
  /** One automation with its latest runs and their judgments. */
  readonly detail: (owner: Owner, id: AutomationId) => Effect.Effect<AutomationDetail, NotFound>
  readonly get: (id: string) => Effect.Effect<AutomationRow | undefined>
  /** Active automations whose trigger the watcher serves. */
  readonly watched: (watcher: Watcher) => Effect.Effect<ReadonlyArray<AutomationRow>>
  /** Active schedules due at `now`. */
  readonly due: (now: DateTime.Utc) => Effect.Effect<ReadonlyArray<AutomationRow>>
  readonly state: (id: string) => Effect.Effect<WatchState>
  readonly saveState: (id: string, state: WatchState) => Effect.Effect<void>
  /** Moves a schedule on to its next time after `after`. */
  readonly schedule: (row: AutomationRow, after: DateTime.Utc) => Effect.Effect<void>
  /** Counts a fire at `at`. */
  readonly fired: (id: string, at: DateTime.Utc) => Effect.Effect<void>
  /** Ends an automation: `done` after its last fire, `expired` past its expiry. */
  readonly end: (id: string, status: "done" | "expired") => Effect.Effect<void>
  readonly toAutomation: (row: AutomationRow) => Automation
}>()("@bluechip/server/Automations") {
  static readonly layer = Layer.effect(
    Automations,
    Effect.gen(function*() {
      const db = yield* Database
      const agents = yield* Agents
      const runs = yield* AutomationRuns
      const audit = yield* AuditLog

      // The policies the automation is checked against: the agent's in force, or the change on its way.
      const specOf = Effect.fnUntraced(function*(owner: Owner, agentId: AgentId | null) {
        if (agentId === null) return null as AgentSpec | null
        const agent = yield* agents.find(owner, agentId)
        return complete(agent.pendingSpec ?? agent.spec)
      })

      const check = Effect.fn("Automations.check")(function*(owner: Owner, draft: AutomationDraft) {
        const spec = yield* specOf(owner, draft.agentId)
        return new AutomationCheck({
          problems: checkAutomation(draft, spec),
          description: describeAutomation(draft, nameOf)
        })
      })

      const valid = Effect.fnUntraced(function*(owner: Owner, draft: AutomationDraft) {
        const { problems } = yield* check(owner, draft)
        if (problems.length > 0) return yield* new InvalidAutomation({ problems })
      })

      const owned = Effect.fnUntraced(function*(owner: Owner, id: string) {
        const [row] = yield* db.select().from(automations).where(and(
          eq(automations.id, id as `automation_${string}`),
          eq(automations.userId, owner.id as `user_${string}`),
          ne(automations.status, "deleted")
        )).pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "automation", id })
        return row
      })

      const nextRunOf = (draft: Pick<AutomationDraft, "trigger">, now: DateTime.Utc) =>
        draft.trigger.type === "schedule" ? nextRun(draft.trigger.config, now) : null

      const record = (row: AutomationRow, action: string) =>
        audit.record({
          userId: row.userId as UserId,
          actor: "owner",
          action: `automation.${action}`,
          subjectType: "automation",
          subjectId: row.id
        })

      const create = Effect.fn("Automations.create")(function*(
        owner: Owner,
        input: { readonly requestId: string; readonly draft: AutomationDraft } & Origin
      ) {
        const requestKey = `request:${input.requestId}`
        const [existing] = yield* db.select().from(automations).where(and(
          eq(automations.userId, owner.id as `user_${string}`),
          eq(automations.requestKey, requestKey)
        )).pipe(Effect.orDie)
        if (existing !== undefined) return toAutomation(existing)

        yield* valid(owner, input.draft)
        const now = yield* DateTime.now
        const { draft } = input
        const [row] = yield* db.insert(automations).values({
          id: typeid("automation").toString() as `automation_${string}`,
          userId: owner.id as `user_${string}`,
          agentId: draft.agentId as `agent_${string}` | null,
          requestKey,
          name: draft.name.trim(),
          trigger: draft.trigger,
          conditions: draft.conditions,
          action: draft.action,
          settings: draft.settings,
          status: "active",
          nextRunAt: nextRunOf(draft, now),
          createdBy: input.createdBy,
          createdFrom: (input.createdFrom ?? null) as `message_${string}` | null,
          createdAt: now,
          updatedAt: now
        }).onConflictDoNothing().returning().pipe(Effect.orDie)
        // Saved meanwhile by the same request.
        if (row === undefined) return yield* new Conflict({ reason: "requestIdReused" })

        yield* db.insert(automationState).values({ automationId: row.id, state: EMPTY_STATE, updatedAt: now })
          .pipe(Effect.orDie)
        yield* record(row, "created")
        return toAutomation(row)
      })

      const update = Effect.fn("Automations.update")(function*(owner: Owner, id: AutomationId, changes: {
        readonly status?: "active" | "paused" | undefined
        readonly draft?: AutomationDraft | undefined
      }) {
        const row = yield* owned(owner, id)
        if (row.status === "done" || row.status === "expired") return yield* new Conflict({ reason: "automationEnded" })

        const now = yield* DateTime.now
        const draft = changes.draft
        if (draft !== undefined) {
          if (draft.agentId !== row.agentId) {
            return yield* new InvalidAutomation({
              problems: [{ part: "name", index: null, field: "agentId", message: "Its agent can't change." }]
            })
          }
          yield* valid(owner, draft)
        }
        const resumed = changes.status === "active" && row.status === "paused"
        const [updated] = yield* db.update(automations).set({
          ...(draft === undefined ? {} : {
            name: draft.name.trim(),
            trigger: draft.trigger,
            conditions: draft.conditions,
            action: draft.action,
            settings: draft.settings
          }),
          ...(changes.status === undefined ? {} : { status: changes.status }),
          // A new trigger, or a schedule resumed, starts from now: no fire for the time it was paused.
          ...(draft !== undefined || resumed ? { nextRunAt: nextRunOf(draft ?? row, now) } : {}),
          updatedAt: now
        }).where(eq(automations.id, row.id)).returning().pipe(Effect.orDie)

        if (draft !== undefined && JSON.stringify(draft.trigger) !== JSON.stringify(row.trigger)) {
          yield* saveState(row.id, EMPTY_STATE)
        }
        yield* record(updated!, draft === undefined ? (changes.status === "paused" ? "paused" : "resumed") : "edited")
        return toAutomation(updated!)
      })

      const remove = Effect.fn("Automations.remove")(function*(owner: Owner, id: AutomationId) {
        const row = yield* owned(owner, id)
        yield* db.update(automations).set({ status: "deleted", nextRunAt: null, updatedAt: yield* DateTime.now })
          .where(eq(automations.id, row.id)).pipe(Effect.orDie)
        yield* record(row, "deleted")
      })

      const list = Effect.fn("Automations.list")(function*(owner: Owner, agentId?: AgentId | undefined) {
        const rows = yield* db.select().from(automations).where(and(
          eq(automations.userId, owner.id as `user_${string}`),
          ne(automations.status, "deleted"),
          agentId === undefined ? undefined : eq(automations.agentId, agentId as `agent_${string}`)
        )).orderBy(desc(automations.id)).pipe(Effect.orDie)
        return rows.map(toAutomation)
      })

      const detail = Effect.fn("Automations.detail")(function*(owner: Owner, id: AutomationId) {
        const row = yield* owned(owner, id)
        const { judgments, runs: latest } = yield* runs.ofAutomation(row.id)
        return new AutomationDetail({ automation: toAutomation(row), runs: latest, judgments })
      })

      const get = Effect.fn("Automations.get")(function*(id: string) {
        const [row] = yield* db.select().from(automations).where(eq(automations.id, id as `automation_${string}`))
          .pipe(Effect.orDie)
        return row
      })

      const watched = Effect.fn("Automations.watched")(function*(watcher: Watcher) {
        const types = TRIGGERS.filter((trigger) => trigger.watcher === watcher).map((trigger) => trigger.type)
        return yield* db.select().from(automations).where(and(
          eq(automations.status, "active"),
          inArray(sql<string>`${automations.trigger}->>'type'`, types)
        )).pipe(Effect.orDie)
      })

      const due = Effect.fn("Automations.due")(function*(now: DateTime.Utc) {
        return yield* db.select().from(automations)
          .where(and(eq(automations.status, "active"), lte(automations.nextRunAt, now)))
          .pipe(Effect.orDie)
      })

      const state = Effect.fn("Automations.state")(function*(id: string) {
        const [row] = yield* db.select().from(automationState)
          .where(eq(automationState.automationId, id as `automation_${string}`)).pipe(Effect.orDie)
        return row?.state ?? EMPTY_STATE
      })

      const saveState = Effect.fn("Automations.saveState")(function*(id: string, next: WatchState) {
        const now = yield* DateTime.now
        yield* db.insert(automationState)
          .values({ automationId: id as `automation_${string}`, state: next, updatedAt: now })
          .onConflictDoUpdate({ target: automationState.automationId, set: { state: next, updatedAt: now } })
          .pipe(Effect.orDie)
      })

      const schedule = Effect.fn("Automations.schedule")(function*(row: AutomationRow, after: DateTime.Utc) {
        yield* db.update(automations).set({ nextRunAt: nextRunOf(row, after) })
          .where(eq(automations.id, row.id)).pipe(Effect.orDie)
      })

      const fired = Effect.fn("Automations.fired")(function*(id: string, at: DateTime.Utc) {
        const row = yield* get(id)
        if (row === undefined) return
        yield* db.update(automations).set({ fires: row.fires + 1, lastFiredAt: at, updatedAt: at })
          .where(eq(automations.id, row.id)).pipe(Effect.orDie)
      })

      const end = Effect.fn("Automations.end")(function*(id: string, status: "done" | "expired") {
        yield* db.update(automations).set({ status, nextRunAt: null, updatedAt: yield* DateTime.now })
          .where(and(eq(automations.id, id as `automation_${string}`), eq(automations.status, "active")))
          .pipe(Effect.orDie)
      })

      return Automations.of({
        catalog: catalogInfo(),
        check,
        create,
        update,
        remove,
        list,
        detail,
        get,
        watched,
        due,
        state,
        saveState,
        schedule,
        fired,
        end,
        toAutomation
      })
    })
  )
}
