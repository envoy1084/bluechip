import type { ChainClient } from "@bluechip/chain/ChainClient"
import {
  Conflict,
  type InsufficientCash,
  type InsufficientShares,
  NotFound,
  type NotTradable,
  type PriceCheckFailed,
  type QuoteUnavailable,
  type SignatureRejected,
  Unavailable
} from "@bluechip/domain/Errors"
import type { AgentId, IntentId, SigningRequestId } from "@bluechip/domain/Ids"
import {
  type Decision,
  type Intent,
  IntentRequest,
  type IntentSource,
  type IntentStatus,
  type Leg
} from "@bluechip/domain/intents/Intent"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { and, desc, eq, inArray, isNotNull, lt } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import { typeid } from "typeid-js"
import type { Hex } from "viem"
import type { AppConfig } from "../Config.ts"
import { Database } from "../db/Database.ts"
import { agents, agentSessions } from "../db/schema/agents.ts"
import { intents } from "../db/schema/intents.ts"
import type { LiveEvents } from "../live/LiveEvents.ts"
import type { ReferencePrices } from "../market/ReferencePrices.ts"
import type { Namera } from "../Namera.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { type TradeLink, Trades } from "../trading/Trades.ts"
import { decide } from "./AgentExecutor.ts"
import { startIntent } from "./Desk.ts"
import { advance, type IntentRow, toIntent } from "./IntentStore.ts"

type TradeError =
  | InsufficientCash
  | InsufficientShares
  | NotTradable
  | QuoteUnavailable
  | PriceCheckFailed
  | NotFound
  | Conflict
  | Unavailable

export type IntentInput = {
  readonly requestId: string
  readonly agentId: AgentId | null
  readonly leg: Leg
  readonly reason?: string | undefined
  readonly source?: IntentSource | undefined
  readonly sourceId?: string | undefined
}

// How long a waiting agent trade keeps trying, and how long an approval stays open.
const OPEN_HOURS = 6

const reasonOf = (input: IntentInput) =>
  input.reason ?? (input.agentId === null ? "You traded." : "You asked this agent to trade.")

/**
 * Every trade goes through here. An agent's trade becomes an intent its desk decides against the agent's onchain
 * policies in the background; your own trade, or an agent's trade you approve, is prepared for your passkey and
 * carried out by the owner executor (`Trades`).
 */
export class Intents extends Context.Service<Intents, {
  readonly preview: (
    owner: Owner,
    agentId: AgentId,
    leg: Leg
  ) => Effect.Effect<Decision, NotFound | Conflict | Unavailable>
  readonly create: (owner: Owner, input: IntentInput) => Effect.Effect<Intent | IntentRequest, TradeError>
  readonly list: (owner: Owner, query: {
    readonly agentId?: AgentId | undefined
    readonly status?: IntentStatus | undefined
    readonly source?: IntentSource | undefined
    readonly pageSize?: number | undefined
    readonly pageToken?: string | undefined
  }) => Effect.Effect<{ readonly items: ReadonlyArray<Intent>; readonly nextPageToken: string | null }>
  readonly find: (owner: Owner, id: IntentId) => Effect.Effect<Intent, NotFound>
  readonly approvals: (owner: Owner) => Effect.Effect<ReadonlyArray<Intent>>
  readonly approve: (owner: Owner, id: IntentId, requestId: string) => Effect.Effect<IntentRequest, TradeError>
  readonly confirm: (
    owner: Owner,
    id: SigningRequestId,
    credential: typeof AuthenticationCredential.Type
  ) => Effect.Effect<Intent, NotFound | Conflict | SignatureRejected | Unavailable>
  readonly decline: (owner: Owner, id: IntentId) => Effect.Effect<Intent, NotFound | Conflict>
  readonly cancel: (owner: Owner, id: IntentId) => Effect.Effect<Intent, NotFound | Conflict>
}>()("@bluechip/server/Intents") {
  static readonly layer = Layer.effect(
    Intents,
    Effect.gen(function*() {
      const db = yield* Database
      const trades = yield* Trades
      const context = yield* Effect.context<
        | Database
        | LiveEvents
        | Namera
        | AppConfig
        | ChainClient
        | ReferencePrices
        | WorkflowEngine.WorkflowEngine
      >()

      const rowOf = Effect.fnUntraced(function*(owner: Owner, id: string) {
        const [row] = yield* db.select().from(intents)
          .where(and(eq(intents.id, id as `intent_${string}`), eq(intents.userId, owner.id as `user_${string}`)))
          .pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "intent", id })
        return row
      })

      // The agent, and its session in force, while it can trade.
      const tradingAgent = Effect.fnUntraced(function*(owner: Owner, agentId: string) {
        const [agent] = yield* db.select().from(agents).where(and(
          eq(agents.id, agentId as `agent_${string}`),
          eq(agents.userId, owner.id as `user_${string}`)
        )).pipe(Effect.orDie)
        if (agent === undefined) return yield* new NotFound({ resource: "agent", id: agentId })
        const [session] = agent.currentSessionId === null ? [] : yield* db.select().from(agentSessions)
          .where(eq(agentSessions.id, agent.currentSessionId)).pipe(Effect.orDie)
        if (agent.paused || agent.status !== "active" || session?.status !== "active") {
          return yield* new Conflict({ reason: "agentBusy" })
        }
        return { agent, session }
      })

      // The intent under this request id, or a new one.
      const insert = Effect.fnUntraced(function*(owner: Owner, input: IntentInput, id: string) {
        const now = yield* DateTime.now
        const dedupeKey = `request:${input.requestId}`
        const [created] = yield* db.insert(intents).values({
          id: id as `intent_${string}`,
          userId: owner.id as `user_${string}`,
          agentId: input.agentId as `agent_${string}` | null,
          source: input.source ?? "owner",
          sourceId: input.sourceId ?? null,
          executor: input.agentId === null ? "owner" : "agent",
          dedupeKey,
          leg: input.leg,
          reason: reasonOf(input),
          status: "proposed",
          expiresAt: input.agentId === null ? null : DateTime.add(now, { hours: OPEN_HOURS }),
          createdAt: now,
          updatedAt: now
        }).onConflictDoNothing().returning().pipe(Effect.orDie)
        if (created !== undefined) return { row: created, created: true }

        const [existing] = yield* db.select().from(intents).where(and(
          eq(intents.userId, owner.id as `user_${string}`),
          eq(intents.dedupeKey, dedupeKey)
        )).pipe(Effect.orDie)
        return { row: existing!, created: false }
      })

      // Prepares an intent for your passkey: your own trade, or an agent's you approve.
      const prepareForOwner = Effect.fnUntraced(function*(
        owner: Owner,
        row: IntentRow,
        requestId: string,
        link: TradeLink
      ) {
        const leg = toIntent(row).leg
        const request = yield* trades.prepare(owner, { requestId, ...leg }, link)
        const prepared = row.status === "awaitingSignature" ? row : yield* advance(row, { _tag: "Prepared" }, {
          signingRequestId: request.id as `signing_${string}`,
          executor: "owner",
          expiresAt: request.expiresAt
        })
        return new IntentRequest({
          id: request.id,
          options: request.options,
          intent: toIntent(prepared),
          quote: request.quote,
          warnings: request.warnings,
          deploysAccount: request.deploysAccount,
          expiresAt: request.expiresAt
        })
      })

      const preview = Effect.fn("Intents.preview")(function*(owner: Owner, agentId: AgentId, leg: Leg) {
        const { agent, session } = yield* tradingAgent(owner, agentId)
        const decided = yield* decide({ agentId: agent.id, account: owner.account as Hex, session: session!, leg })
          .pipe(
            Effect.catchTag(
              "ChainError",
              () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }))
            )
          )
        return decided.decision
      }, Effect.provideContext(context))

      const create = Effect.fn("Intents.create")(function*(owner: Owner, input: IntentInput) {
        if (input.agentId === null) {
          // A trade that can't be prepared (no cash, no quote, an unfair price) leaves no intent behind.
          const { row } = yield* insert(owner, input, typeid("intent").toString())
          return yield* prepareForOwner(owner, row, input.requestId, {
            intentId: row.id,
            agentId: null,
            source: "owner"
          })
            .pipe(
              Effect.tapError(() =>
                row.status === "proposed"
                  ? db.delete(intents).where(eq(intents.id, row.id)).pipe(Effect.ignore)
                  : Effect.void
              )
            )
        }

        yield* tradingAgent(owner, input.agentId)
        const { created, row } = yield* insert(owner, input, typeid("intent").toString())
        if (created) yield* startIntent(row)
        return toIntent(row)
      }, Effect.provideContext(context))

      const list = Effect.fn("Intents.list")(function*(owner: Owner, query: {
        readonly agentId?: AgentId | undefined
        readonly status?: IntentStatus | undefined
        readonly source?: IntentSource | undefined
        readonly pageSize?: number | undefined
        readonly pageToken?: string | undefined
      }) {
        const size = query.pageSize ?? 25
        const rows = yield* db.select().from(intents).where(and(
          eq(intents.userId, owner.id as `user_${string}`),
          query.agentId === undefined ? undefined : eq(intents.agentId, query.agentId as `agent_${string}`),
          query.status === undefined ? undefined : eq(intents.status, query.status),
          query.source === undefined ? undefined : eq(intents.source, query.source),
          query.pageToken === undefined ? undefined : lt(intents.id, query.pageToken as `intent_${string}`)
        )).orderBy(desc(intents.id)).limit(size + 1).pipe(Effect.orDie)

        const items = rows.slice(0, size).map(toIntent)
        return { items, nextPageToken: rows.length > size ? items.at(-1)!.id as string : null }
      })

      const find = Effect.fn("Intents.find")(function*(owner: Owner, id: IntentId) {
        return toIntent(yield* rowOf(owner, id))
      })

      // Agent trades waiting for you: over their largest trade, or approved and waiting for your signature.
      const approvals = Effect.fn("Intents.approvals")(function*(owner: Owner) {
        const rows = yield* db.select().from(intents).where(and(
          eq(intents.userId, owner.id as `user_${string}`),
          isNotNull(intents.agentId),
          inArray(intents.status, ["needsApproval", "awaitingSignature"])
        )).orderBy(desc(intents.id)).pipe(Effect.orDie)
        return rows.map(toIntent)
      })

      const approve = Effect.fn("Intents.approve")(function*(owner: Owner, id: IntentId, requestId: string) {
        const row = yield* rowOf(owner, id)
        if (row.status !== "needsApproval" && row.status !== "awaitingSignature") {
          return yield* new Conflict({ reason: "intentClosed" })
        }
        yield* tradingAgent(owner, row.agentId!)
        return yield* prepareForOwner(owner, row, requestId, {
          intentId: row.id,
          agentId: row.agentId,
          source: "approval"
        })
      }, Effect.provideContext(context))

      const confirm = Effect.fn("Intents.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const trade = yield* trades.confirm(owner, id, credential)
        const [row] = yield* db.select().from(intents).where(eq(intents.tradeId, trade.id as `trade_${string}`))
          .pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "intent", id })
        return toIntent(row)
      })

      const end = (event: "Declined" | "Cancelled") =>
        Effect.fnUntraced(function*(owner: Owner, id: IntentId) {
          const row = yield* rowOf(owner, id)
          return toIntent(yield* advance(row, { _tag: event }))
        }, Effect.provideContext(context))

      return {
        preview,
        create,
        list,
        find,
        approvals,
        approve,
        confirm,
        decline: Effect.fn("Intents.decline")(end("Declined")),
        cancel: Effect.fn("Intents.cancel")(end("Cancelled"))
      }
    })
  )
}
