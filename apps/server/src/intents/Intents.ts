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
import type { AgentId, IntentId, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import { type Decision, type Intent, IntentRequest, type Leg } from "@bluechip/domain/intents/Intent"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { and, eq } from "drizzle-orm"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import type { Hex } from "viem"
import { Database } from "../db/Database.ts"
import { agents, agentSessions } from "../db/schema/agents.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { type TradeLink, Trades } from "../trading/Trades.ts"
import { AgentExecutor } from "./AgentExecutor.ts"
import { ExecuteIntent } from "./Desk.ts"
import { type IntentInput, type IntentRow, IntentStore, toIntent } from "./IntentStore.ts"

type TradeError =
  | InsufficientCash
  | InsufficientShares
  | NotTradable
  | QuoteUnavailable
  | PriceCheckFailed
  | NotFound
  | Conflict
  | Unavailable

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
  readonly list: IntentStore["Service"]["list"]
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
      const store = yield* IntentStore
      const trades = yield* Trades
      const executor = yield* AgentExecutor
      const engine = yield* WorkflowEngine.WorkflowEngine

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

      // Prepares an intent for your passkey: your own trade, or an agent's you approve.
      const prepareForOwner = Effect.fnUntraced(function*(
        owner: Owner,
        row: IntentRow,
        requestId: string,
        link: TradeLink
      ) {
        const request = yield* trades.prepare(owner, { requestId, ...row.leg }, link)
        const prepared = row.status === "awaitingSignature" ? row : yield* store.advance(row, { _tag: "Prepared" }, {
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
        const decided = yield* executor.decide({ agentId: agent.id, account: owner.account as Hex, session, leg })
          .pipe(
            Effect.catchTag(
              "ChainError",
              () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }))
            )
          )
        return decided.decision
      })

      const create = Effect.fn("Intents.create")(function*(owner: Owner, input: IntentInput) {
        if (input.agentId === null) {
          // A trade that can't be prepared (no cash, no quote, an unfair price) leaves no intent behind.
          const { row } = yield* store.insert(owner, input)
          return yield* prepareForOwner(owner, row, input.requestId, {
            intentId: row.id,
            agentId: null,
            source: "owner"
          }).pipe(Effect.tapError(() => row.status === "proposed" ? store.remove(row.id) : Effect.void))
        }

        yield* tradingAgent(owner, input.agentId)
        const { created, row } = yield* store.insert(owner, input)
        // Started once: the workflow is keyed by the intent.
        if (created) {
          yield* ExecuteIntent.execute({ intentId: row.id, userId: row.userId as UserId }, { discard: true }).pipe(
            Effect.provideService(WorkflowEngine.WorkflowEngine, engine)
          )
        }
        return toIntent(row)
      })

      const find = Effect.fn("Intents.find")(function*(owner: Owner, id: IntentId) {
        return toIntent(yield* store.owned(owner, id))
      })

      const approve = Effect.fn("Intents.approve")(function*(owner: Owner, id: IntentId, requestId: string) {
        const row = yield* store.owned(owner, id)
        if (row.status !== "needsApproval" && row.status !== "awaitingSignature") {
          return yield* new Conflict({ reason: "intentClosed" })
        }
        yield* tradingAgent(owner, row.agentId!)
        return yield* prepareForOwner(owner, row, requestId, {
          intentId: row.id,
          agentId: row.agentId,
          source: "approval"
        })
      })

      const confirm = Effect.fn("Intents.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const trade = yield* trades.confirm(owner, id, credential)
        const row = yield* store.byTrade(trade.id)
        if (row === undefined) return yield* new NotFound({ resource: "intent", id })
        return toIntent(row)
      })

      const end = (event: "Declined" | "Cancelled") =>
        Effect.fnUntraced(function*(owner: Owner, id: IntentId) {
          const row = yield* store.owned(owner, id)
          return toIntent(yield* store.advance(row, { _tag: event }))
        })

      return Intents.of({
        preview,
        create,
        list: store.list,
        find,
        approvals: store.approvals,
        approve,
        confirm,
        decline: Effect.fn("Intents.decline")(end("Declined")),
        cancel: Effect.fn("Intents.cancel")(end("Cancelled"))
      })
    })
  )
}
