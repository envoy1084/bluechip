import { sessionPolicies } from "@bluechip/chain/agents/Policies"
import { agentSession, lockCalls, lockedGrant, readUsage } from "@bluechip/chain/agents/Sessions"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { type Agent, type AgentAction, AgentRequest, AgentUsage, transition } from "@bluechip/domain/agents/Agent"
import { GRANT_DAYS, type Limits } from "@bluechip/domain/agents/Limits"
import { policyConfig } from "@bluechip/domain/agents/PolicyConfig"
import { validate } from "@bluechip/domain/agents/Rules"
import type { Template } from "@bluechip/domain/agents/Templates"
import { Conflict, InvalidLimits, NotFound, type SignatureRejected, Unavailable } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import * as Grant from "@namera-ai/sdk/Grant"
import type * as Session from "@namera-ai/sdk/Session"
import { and, asc, eq, inArray, isNotNull, ne } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import { typeid } from "typeid-js"
import type { Hex } from "viem"
import { AppConfig } from "../Config.ts"
import { Database } from "../db/Database.ts"
import { agentKeys, agents } from "../db/schema/agents.ts"
import { LiveEvents } from "../live/LiveEvents.ts"
import type { Namera } from "../Namera.ts"
import { ownerAccount, type OwnerPasskey, sendOperation, waitForOperation } from "../signing/OwnerOperations.ts"
import {
  claimSigningRequest,
  createSigningRequest,
  findPrepared,
  type Owner,
  ownerPasskey,
  type SigningRequestRow,
  webAuthnOptions
} from "../signing/SigningRequests.ts"
import { type AgentRow, decodeLimits, encodeLimits, toAgent } from "./AgentRecords.ts"
import { newAgentKey } from "./Keys.ts"

export type AgentInput = {
  readonly requestId: string
  readonly name: string
  readonly template: Template
  readonly limits: Limits
}

const unavailable = Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }))

const sessionOf = (row: AgentRow, limits: Limits, validUntil: DateTime.Utc): Session.Session =>
  agentSession({
    limits,
    signer: row.sessionKey as Hex,
    validUntil: Math.floor(DateTime.toEpochMillis(validUntil) / 1000)
  })

// Every policy but the first (`Policy.anyCall`, the same in every session): what a change swaps.
const limitPolicies = (limits: Limits) => sessionPolicies(policyConfig(limits)).slice(1)

const changeOf = (grant: Grant.Grant, before: Limits, after: Limits) =>
  Grant.updateCalls(grant, { remove: limitPolicies(before), add: limitPolicies(after) })

// Namera's owner calls send no value, and always carry data.
const ownerCalls = (calls: ReadonlyArray<{ readonly to: Hex; readonly data?: Hex | undefined }>) =>
  calls.map((call) => ({ to: call.to, data: call.data ?? "0x" }))

/**
 * Agents with the account's passkey: creating one prepares its lock (an owner operation enabling its Namera session),
 * a change of limits or a removal prepares the operation that does it, and `confirm` sends what the passkey signed.
 * Each operation is followed to its receipt in the background (and again after a restart); the agent then moves on
 * (`transition`) and the owner gets `AgentChanged`. Pausing only stops bluechip sending its trades.
 */
export class Agents extends Context.Service<Agents, {
  readonly list: (owner: Owner) => Effect.Effect<ReadonlyArray<Agent>>
  readonly find: (owner: Owner, id: AgentId) => Effect.Effect<Agent, NotFound>
  readonly usage: (owner: Owner, id: AgentId) => Effect.Effect<AgentUsage, NotFound | Unavailable>
  readonly create: (
    owner: Owner,
    input: AgentInput
  ) => Effect.Effect<AgentRequest, InvalidLimits | Conflict | NotFound | Unavailable>
  readonly lock: (
    owner: Owner,
    id: AgentId,
    requestId: string
  ) => Effect.Effect<AgentRequest, NotFound | Conflict | Unavailable>
  readonly changeLimits: (
    owner: Owner,
    id: AgentId,
    input: { readonly requestId: string; readonly limits: Limits }
  ) => Effect.Effect<AgentRequest, InvalidLimits | NotFound | Conflict | Unavailable>
  readonly remove: (
    owner: Owner,
    id: AgentId,
    requestId: string
  ) => Effect.Effect<Agent | AgentRequest, NotFound | Conflict | Unavailable>
  readonly confirm: (
    owner: Owner,
    id: SigningRequestId,
    credential: typeof AuthenticationCredential.Type
  ) => Effect.Effect<Agent, NotFound | Conflict | SignatureRejected | Unavailable>
  readonly pause: (owner: Owner, id: AgentId) => Effect.Effect<Agent, NotFound | Conflict>
  readonly resume: (owner: Owner, id: AgentId) => Effect.Effect<Agent, NotFound | Conflict>
  readonly pauseAll: (owner: Owner) => Effect.Effect<ReadonlyArray<Agent>>
  readonly resumeAll: (owner: Owner) => Effect.Effect<ReadonlyArray<Agent>>
}>()("@bluechip/server/Agents") {
  static readonly layer = Layer.effect(
    Agents,
    Effect.gen(function*() {
      const db = yield* Database
      const live = yield* LiveEvents
      const config = yield* AppConfig
      const context = yield* Effect.context<Namera | Database | AppConfig | ChainClient>()
      const scope = yield* Effect.scope

      const rowOf = Effect.fnUntraced(function*(owner: Owner, id: AgentId) {
        const [row] = yield* db.select().from(agents)
          .where(and(eq(agents.id, id as `agent_${string}`), eq(agents.userId, owner.id as `user_${string}`)))
          .pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "agent", id })
        return row
      })

      const save = Effect.fnUntraced(function*(row: AgentRow, changes: Partial<AgentRow>) {
        const [updated] = yield* db.update(agents).set({ ...changes, updatedAt: yield* DateTime.now })
          .where(eq(agents.id, row.id)).returning().pipe(Effect.orDie)
        const agent = toAgent(updated!)
        yield* live.publish(LiveEvent.cases.AgentChanged.make({ agent }), row.userId as UserId)
        return agent
      })

      const toRequest = Effect.fnUntraced(function*(request: SigningRequestRow, row: AgentRow) {
        return new AgentRequest({
          id: request.id as SigningRequestId,
          options: yield* webAuthnOptions(request),
          action: request.payload["action"] as AgentAction,
          agent: toAgent(row),
          deploysAccount: request.deploysAccount,
          expiresAt: request.expiresAt
        })
      })

      // The request prepared under this request id for the same agent and action, if any.
      const prepared = Effect.fnUntraced(
        function*(owner: Owner, requestId: string, row: AgentRow, action: AgentAction) {
          const existing = yield* findPrepared(
            owner,
            requestId,
            (payload) => payload["agentId"] === row.id && payload["action"] === action
          )
          return Option.isSome(existing) ? Option.some(yield* toRequest(existing.value, row)) : Option.none()
        }
      )

      const prepareLock = Effect.fnUntraced(function*(owner: Owner, row: AgentRow, requestId: string) {
        const validUntil = DateTime.add(yield* DateTime.now, { days: GRANT_DAYS })
        const request = yield* createSigningRequest(owner, {
          requestId,
          kind: "agent",
          payload: { agentId: row.id, action: "lock", validUntil: DateTime.formatIso(validUntil) },
          calls: lockCalls(sessionOf(row, decodeLimits(row.limits), validUntil))
        })
        return yield* toRequest(request, row)
      })

      const requireValid = (limits: Limits, template: Template) => {
        const problems = validate(limits, template)
        return problems.length === 0 ? Effect.void : Effect.fail(new InvalidLimits({ problems }))
      }

      // What an operation that landed (or not) does to the agent.
      const settle = Effect.fnUntraced(function*(row: AgentRow, passkey: OwnerPasskey) {
        const outcome = yield* waitForOperation(passkey, row.userOpHash as Hex).pipe(Effect.result)
        const landed = outcome._tag === "Success" && outcome.success.success
        const next = transition(row.status, { _tag: landed ? "Landed" : "Failed" })
        if (Result.isFailure(next)) return yield* Effect.logWarning(`Agent ${row.id}: ${next.failure}`)

        const done = { status: next.success, userOpHash: null, pendingLimits: null }
        if (!landed) return yield* save(row, row.status === "locking" ? { ...done, lockedUntil: null } : done)

        switch (row.status) {
          case "locking": {
            const session = sessionOf(row, decodeLimits(row.limits), row.lockedUntil!)
            const grant = yield* lockedGrant(yield* ownerAccount(passkey), session)
            return yield* save(row, { ...done, grant: Grant.serialize(grant) })
          }
          case "updating": {
            const grant = Grant.parse(row.grant!)
            const after = decodeLimits(row.pendingLimits)
            const { session } = changeOf(grant, decodeLimits(row.limits), after)
            const updated = Grant.parse({ ...grant, session, summary: Grant.describe({ ...grant, session }) })
            return yield* save(row, { ...done, limits: row.pendingLimits, grant: Grant.serialize(updated) })
          }
          default:
            return yield* save(row, done)
        }
      }, Effect.catchTag("ChainError", (error) => Effect.logWarning("Agent settle failed", error)))

      const track = (row: AgentRow, passkey: OwnerPasskey) =>
        settle(row, passkey).pipe(
          Effect.catch((error) => Effect.logWarning(`Agent ${row.id} settle failed`, error)),
          Effect.provideContext(context),
          Effect.forkIn(scope),
          Effect.asVoid
        )

      const pending = yield* db.select().from(agents)
        .where(and(inArray(agents.status, ["locking", "updating", "removing"]), isNotNull(agents.userOpHash)))
        .pipe(Effect.orDie)
      for (const row of pending) {
        yield* track(row, yield* ownerPasskey(row.userId as UserId).pipe(Effect.provideContext(context)))
      }

      const list = Effect.fn("Agents.list")(function*(owner: Owner) {
        const rows = yield* db.select().from(agents)
          .where(and(eq(agents.userId, owner.id as `user_${string}`), ne(agents.status, "removed")))
          .orderBy(asc(agents.createdAt)).pipe(Effect.orDie)
        return rows.map(toAgent)
      })

      const find = Effect.fn("Agents.find")(function*(owner: Owner, id: AgentId) {
        return toAgent(yield* rowOf(owner, id))
      })

      const usage = Effect.fn("Agents.usage")(function*(owner: Owner, id: AgentId) {
        const row = yield* rowOf(owner, id)
        if (row.grant === null || row.status === "removed") {
          return new AgentUsage({
            spentToday: Usdc.make(BigInt(0)),
            tradesToday: 0,
            slippageThisWeek: Usdc.make(BigInt(0))
          })
        }

        const grant = Grant.parse(row.grant)
        const chain = yield* ChainClient
        const now = Math.floor(DateTime.toEpochMillis(yield* DateTime.now) / 1000)
        const counted = yield* readUsage({ account: owner.account as Hex, permissionId: grant.id, now }).pipe(
          Effect.catchTag("ChainError", () => unavailable)
        )
        const status = yield* Effect.tryPromise(() => Grant.getStatus(chain.client, { grant })).pipe(
          Effect.catch(() => unavailable)
        )
        const trades = status.limits.find((limit) => limit.kind === "rateLimit")
        return new AgentUsage({ ...counted, tradesToday: Number(trades?.used ?? BigInt(0)) })
      }, Effect.provideContext(context))

      const create = Effect.fn("Agents.create")(function*(owner: Owner, input: AgentInput) {
        yield* requireValid(input.limits, input.template)
        const existing = yield* findPrepared(owner, input.requestId, (payload) => payload["action"] === "lock")
        if (Option.isSome(existing)) {
          const row = yield* rowOf(owner, existing.value.payload["agentId"] as AgentId)
          return yield* toRequest(existing.value, row)
        }

        const id = typeid("agent").toString() as `agent_${string}`
        const key = newAgentKey(config.agentKeyEncryptionKey, id)
        const now = yield* DateTime.now
        const row = yield* db.transaction((tx) =>
          Effect.gen(function*() {
            const [inserted] = yield* tx.insert(agents).values({
              id,
              userId: owner.id as `user_${string}`,
              name: input.name,
              template: input.template,
              status: "draft",
              limits: encodeLimits(input.limits),
              sessionKey: key.address,
              createdAt: now,
              updatedAt: now
            }).returning()
            yield* tx.insert(agentKeys).values({ agentId: id, ciphertext: key.ciphertext, createdAt: now })
            return inserted!
          })
        ).pipe(Effect.orDie)

        return yield* prepareLock(owner, row, input.requestId)
      }, Effect.provideContext(context))

      const lock = Effect.fn("Agents.lock")(function*(owner: Owner, id: AgentId, requestId: string) {
        const row = yield* rowOf(owner, id)
        const existing = yield* prepared(owner, requestId, row, "lock")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "draft") return yield* new Conflict({ reason: "agentBusy" })
        return yield* prepareLock(owner, row, requestId)
      }, Effect.provideContext(context))

      const changeLimits = Effect.fn("Agents.changeLimits")(function*(
        owner: Owner,
        id: AgentId,
        input: { readonly requestId: string; readonly limits: Limits }
      ) {
        const row = yield* rowOf(owner, id)
        const existing = yield* prepared(owner, input.requestId, row, "update")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "active") return yield* new Conflict({ reason: "agentBusy" })
        yield* requireValid(input.limits, row.template)

        const change = changeOf(Grant.parse(row.grant!), decodeLimits(row.limits), input.limits)
        const request = yield* createSigningRequest(owner, {
          requestId: input.requestId,
          kind: "agent",
          payload: { agentId: row.id, action: "update", limits: JSON.stringify(encodeLimits(input.limits)) },
          calls: ownerCalls(change.calls)
        })
        return yield* toRequest(request, row)
      }, Effect.provideContext(context))

      const remove = Effect.fn("Agents.remove")(function*(owner: Owner, id: AgentId, requestId: string) {
        const row = yield* rowOf(owner, id)
        if (row.status === "draft") {
          return yield* save(row, { status: Result.getOrThrow(transition(row.status, { _tag: "Discarded" })) })
        }
        const existing = yield* prepared(owner, requestId, row, "remove")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "active") return yield* new Conflict({ reason: "agentBusy" })

        const request = yield* createSigningRequest(owner, {
          requestId,
          kind: "agent",
          payload: { agentId: row.id, action: "remove" },
          calls: ownerCalls(Grant.revokeCalls(Grant.parse(row.grant!)))
        })
        return yield* toRequest(request, row)
      }, Effect.provideContext(context))

      const confirm = Effect.fn("Agents.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const { passkey, request } = yield* claimSigningRequest(owner, id, "agent", credential)
        const action = request.payload["action"] as AgentAction
        const row = yield* rowOf(owner, request.payload["agentId"] as AgentId)
        const next = transition(row.status, { _tag: "Sent", action })
        if (Result.isFailure(next)) return yield* new Conflict({ reason: "agentBusy" })

        const userOpHash = yield* sendOperation(passkey, request.userOperation, credential)
        const changes = {
          status: next.success,
          userOpHash,
          ...(action === "lock" ? { lockedUntil: DateTime.makeUnsafe(request.payload["validUntil"]!) } : {}),
          ...(action === "update" ? { pendingLimits: JSON.parse(request.payload["limits"]!) } : {})
        }
        const agent = yield* save(row, changes)
        yield* track({ ...row, ...changes }, passkey)
        return agent
      }, Effect.provideContext(context))

      const setPaused = (paused: boolean) =>
        Effect.fnUntraced(function*(owner: Owner, id: AgentId) {
          const row = yield* rowOf(owner, id)
          if (row.status === "draft" || row.status === "removed") return yield* new Conflict({ reason: "agentBusy" })
          return row.paused === paused ? toAgent(row) : yield* save(row, { paused })
        })

      const setAllPaused = (paused: boolean) =>
        Effect.fnUntraced(function*(owner: Owner) {
          const rows = yield* db.select().from(agents).where(and(
            eq(agents.userId, owner.id as `user_${string}`),
            inArray(agents.status, ["locking", "active", "updating", "removing"]),
            eq(agents.paused, !paused)
          )).pipe(Effect.orDie)
          for (const row of rows) yield* save(row, { paused })
          return yield* list(owner)
        })

      return {
        list,
        find,
        usage,
        create,
        lock,
        changeLimits,
        remove,
        confirm,
        pause: Effect.fn("Agents.pause")(setPaused(true)),
        resume: Effect.fn("Agents.resume")(setPaused(false)),
        pauseAll: Effect.fn("Agents.pauseAll")(setAllPaused(true)),
        resumeAll: Effect.fn("Agents.resumeAll")(setAllPaused(false))
      }
    })
  )
}
