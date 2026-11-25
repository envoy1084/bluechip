import type { ChainClient } from "@bluechip/chain/ChainClient"
import {
  agentSession,
  changeCalls,
  changedGrant,
  lockCalls,
  lockedGrant,
  renewCalls,
  revokeCalls
} from "@bluechip/chain/policies/Session"
import { readUsage } from "@bluechip/chain/policies/Usage"
import {
  type Agent,
  type AgentAction,
  AgentRequest,
  type AgentSession,
  AgentUsage,
  SESSION_DAYS,
  transition
} from "@bluechip/domain/agents/Agent"
import { Conflict, InvalidSpec, NotFound, type SignatureRejected, Unavailable } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { checkSpec, complete } from "@bluechip/domain/policies/Catalog"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import * as Grant from "@namera-ai/sdk/Grant"
import * as Session from "@namera-ai/sdk/Session"
import { and, asc, eq, inArray, ne } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import { typeid } from "typeid-js"
import type { Address, Hex } from "viem"
import { AppConfig } from "../Config.ts"
import { Database } from "../db/Database.ts"
import { agents, sessionKeys } from "../db/schema/agents.ts"
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
import { type AgentRow, decodeSpec, type SessionRow, toAgent, toSession } from "./AgentRecords.ts"
import { newAgentKey } from "./Keys.ts"
import { SavedTemplates } from "./SavedTemplates.ts"
import { insertSession, saveSession, sessionRow, sessionsOf } from "./SessionRecords.ts"

export type AgentInput = {
  readonly requestId: string
  readonly name: string
  readonly template: string | null
  readonly spec: AgentSpec
}

const unavailable = Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }))

const seconds = (time: DateTime.Utc) => Math.floor(DateTime.toEpochMillis(time) / 1000)

// The Namera session a session row locks: its spec's policies, signed by its key, until its end.
const sessionOf = (row: SessionRow): Session.Session =>
  agentSession({ spec: decodeSpec(row.spec), signer: row.sessionKey as Address, validUntil: seconds(row.validUntil!) })

/**
 * Agents with the account's passkey. Creating one prepares its lock (an owner operation enabling a Namera session
 * compiled from its spec); a change of policies, a renewal (a new key, the same policies) or a removal prepares the
 * operation that does it; and `confirm` sends what the passkey signed. Each lock, change and renewal is a session in
 * the agent's history. Operations are followed to their receipt in the background (and again after a restart); the
 * agent then moves on (`transition`) and the owner gets `AgentChanged`. Pausing only stops bluechip sending its trades.
 */
export class Agents extends Context.Service<Agents, {
  readonly list: (owner: Owner) => Effect.Effect<ReadonlyArray<Agent>>
  readonly find: (owner: Owner, id: AgentId) => Effect.Effect<Agent, NotFound>
  readonly sessions: (owner: Owner, id: AgentId) => Effect.Effect<ReadonlyArray<AgentSession>, NotFound>
  readonly usage: (owner: Owner, id: AgentId) => Effect.Effect<AgentUsage, NotFound | Unavailable>
  readonly create: (
    owner: Owner,
    input: AgentInput
  ) => Effect.Effect<AgentRequest, InvalidSpec | Conflict | NotFound | Unavailable>
  readonly lock: (
    owner: Owner,
    id: AgentId,
    requestId: string
  ) => Effect.Effect<AgentRequest, NotFound | Conflict | Unavailable>
  readonly change: (
    owner: Owner,
    id: AgentId,
    input: { readonly requestId: string; readonly spec: AgentSpec }
  ) => Effect.Effect<AgentRequest, InvalidSpec | NotFound | Conflict | Unavailable>
  readonly renew: (
    owner: Owner,
    id: AgentId,
    requestId: string
  ) => Effect.Effect<AgentRequest, NotFound | Conflict | Unavailable>
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
      const templates = yield* SavedTemplates
      const context = yield* Effect.context<Namera | Database | AppConfig | ChainClient>()
      const scope = yield* Effect.scope

      const rowOf = Effect.fnUntraced(function*(owner: Owner, id: AgentId) {
        const [row] = yield* db.select().from(agents)
          .where(and(eq(agents.id, id as `agent_${string}`), eq(agents.userId, owner.id as `user_${string}`)))
          .pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "agent", id })
        return row
      })

      const agentOf = Effect.fnUntraced(function*(row: AgentRow) {
        return toAgent(row, yield* sessionsOf([row.id]).pipe(Effect.provideService(Database, db)))
      })

      const save = Effect.fnUntraced(function*(row: AgentRow, changes: Partial<AgentRow>) {
        const [updated] = yield* db.update(agents).set({ ...changes, updatedAt: yield* DateTime.now })
          .where(eq(agents.id, row.id)).returning().pipe(Effect.orDie)
        const agent = yield* agentOf(updated!)
        yield* live.publish(LiveEvent.cases.AgentChanged.make({ agent }), row.userId as UserId)
        return agent
      })

      const toRequest = Effect.fnUntraced(function*(request: SigningRequestRow, row: AgentRow) {
        return new AgentRequest({
          id: request.id as SigningRequestId,
          options: yield* webAuthnOptions(request),
          action: request.payload["action"] as AgentAction,
          agent: yield* agentOf(row),
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

      const requireValid = (spec: AgentSpec) => {
        const problems = checkSpec(spec)
        return problems.length === 0 ? Effect.void : Effect.fail(new InvalidSpec({ problems }))
      }

      const prepare = Effect.fnUntraced(function*(
        owner: Owner,
        row: AgentRow,
        request: {
          readonly requestId: string
          readonly action: AgentAction
          readonly sessionId?: string | undefined
          readonly calls: ReadonlyArray<{ readonly to: Hex; readonly data: Hex }>
        }
      ) {
        const signing = yield* createSigningRequest(owner, {
          requestId: request.requestId,
          kind: "agent",
          payload: {
            agentId: row.id,
            action: request.action,
            ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId })
          },
          calls: request.calls
        })
        return yield* toRequest(signing, row)
      })

      // A draft's session, given a fresh 90 days, and the owner operation that locks it.
      const prepareLock = Effect.fnUntraced(function*(owner: Owner, row: AgentRow, requestId: string) {
        const draft = yield* sessionRow(row.pendingSessionId)
        const validUntil = DateTime.add(yield* DateTime.now, { days: SESSION_DAYS })
        const session = sessionOf({ ...draft, validUntil })
        yield* saveSession(draft.id, { validUntil, permissionId: Session.getPermissionId(session) })
        return yield* prepare(owner, row, { requestId, action: "lock", sessionId: draft.id, calls: lockCalls(session) })
      })

      // A new key for the agent, its private key sealed at rest.
      const newKey = Effect.fnUntraced(
        function*(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], agentId: AgentRow["id"], now: DateTime.Utc) {
          const key = newAgentKey(config.agentKeyEncryptionKey, agentId)
          yield* tx.insert(sessionKeys).values({
            address: key.address,
            agentId,
            ciphertext: key.ciphertext,
            createdAt: now
          })
          return key.address
        }
      )

      // What an operation that landed (or not) does to the agent and its sessions.
      const settle = Effect.fnUntraced(function*(agentId: AgentRow["id"], passkey: OwnerPasskey) {
        const [row] = yield* db.select().from(agents).where(eq(agents.id, agentId)).pipe(Effect.orDie)
        if (row === undefined) return
        const sending = yield* sessionRow(row.status === "removing" ? row.currentSessionId : row.pendingSessionId)
        const outcome = yield* waitForOperation(passkey, sending.userOpHash as Hex).pipe(Effect.result)
        const landed = outcome._tag === "Success" && outcome.success.success
        const next = transition(row.status, { _tag: landed ? "Landed" : "Failed" })
        if (Result.isFailure(next)) return yield* Effect.logWarning(`Agent ${row.id}: ${next.failure}`)

        const now = yield* DateTime.now
        if (!landed) {
          yield* saveSession(sending.id, {
            status: row.status === "locking" ? "draft" : row.status === "removing" ? "active" : "failed",
            userOpHash: null
          })
          return yield* save(row, {
            status: next.success,
            ...(row.status === "updating" ? { pendingSessionId: null } : {})
          })
        }

        if (row.status === "removing") {
          yield* saveSession(sending.id, { status: "revoked", endedAt: now, userOpHash: null })
          return yield* save(row, { status: next.success })
        }

        const current = row.currentSessionId === null ? undefined : yield* sessionRow(row.currentSessionId)
        // A change keeps the session's key and permission: its grant is the current one, changed.
        const grant = current !== undefined && current.sessionKey === sending.sessionKey ?
          changedGrant(
            Grant.parse(current.grant!),
            changeCalls(Grant.parse(current.grant!), decodeSpec(current.spec), decodeSpec(sending.spec)).session
          ) :
          yield* lockedGrant(yield* ownerAccount(passkey), sessionOf(sending))
        yield* saveSession(sending.id, {
          status: "active",
          grant: Grant.serialize(grant),
          installedAt: now,
          userOpHash: null
        })
        if (current !== undefined) yield* saveSession(current.id, { status: "replaced", endedAt: now })
        return yield* save(row, { status: next.success, currentSessionId: sending.id, pendingSessionId: null })
      }, Effect.catchTag("ChainError", (error) => Effect.logWarning("Agent settle failed", error)))

      const track = (agentId: AgentRow["id"], passkey: OwnerPasskey) =>
        settle(agentId, passkey).pipe(
          Effect.catch((error) => Effect.logWarning(`Agent ${agentId} settle failed`, error)),
          Effect.provideContext(context),
          Effect.forkIn(scope),
          Effect.asVoid
        )

      const inFlight = yield* db.select().from(agents)
        .where(inArray(agents.status, ["locking", "updating", "removing"])).pipe(Effect.orDie)
      for (const row of inFlight) {
        yield* track(row.id, yield* ownerPasskey(row.userId as UserId).pipe(Effect.provideContext(context)))
      }

      const list = Effect.fn("Agents.list")(function*(owner: Owner) {
        const rows = yield* db.select().from(agents)
          .where(and(eq(agents.userId, owner.id as `user_${string}`), ne(agents.status, "removed")))
          .orderBy(asc(agents.createdAt)).pipe(Effect.orDie)
        const sessions = yield* sessionsOf(rows.map((row) => row.id)).pipe(Effect.provideService(Database, db))
        return rows.map((row) => toAgent(row, sessions.filter((session) => session.agentId === row.id)))
      })

      const find = Effect.fn("Agents.find")(function*(owner: Owner, id: AgentId) {
        return yield* agentOf(yield* rowOf(owner, id))
      })

      const sessions = Effect.fn("Agents.sessions")(function*(owner: Owner, id: AgentId) {
        const row = yield* rowOf(owner, id)
        const rows = yield* sessionsOf([row.id]).pipe(Effect.provideService(Database, db))
        // Changes prepared but never signed stay out of the history.
        return rows.filter((session) => session.status !== "draft" || session.id === row.pendingSessionId)
          .map(toSession)
      })

      const usage = Effect.fn("Agents.usage")(function*(owner: Owner, id: AgentId) {
        const row = yield* rowOf(owner, id)
        if (row.currentSessionId === null || row.status === "removed") return new AgentUsage({ policies: [] })

        const current = yield* sessionRow(row.currentSessionId)
        const policies = yield* readUsage({
          spec: decodeSpec(current.spec),
          account: owner.account as Address,
          grant: Grant.parse(current.grant!),
          now: seconds(yield* DateTime.now)
        }).pipe(Effect.catchTag("ChainError", () => unavailable))
        return new AgentUsage({ policies })
      }, Effect.provideContext(context))

      const create = Effect.fn("Agents.create")(function*(owner: Owner, input: AgentInput) {
        const spec = complete(input.spec)
        yield* requireValid(spec)
        const existing = yield* findPrepared(owner, input.requestId, (payload) => payload["action"] === "lock")
        if (Option.isSome(existing)) {
          const row = yield* rowOf(owner, existing.value.payload["agentId"] as AgentId)
          return yield* toRequest(existing.value, row)
        }
        if (input.template !== null) yield* templates.requireExists(owner, input.template)

        const id = typeid("agent").toString() as `agent_${string}`
        const now = yield* DateTime.now
        const row = yield* db.transaction((tx) =>
          Effect.gen(function*() {
            yield* tx.insert(agents).values({
              id,
              userId: owner.id as `user_${string}`,
              name: input.name,
              templateId: input.template,
              status: "draft",
              createdAt: now,
              updatedAt: now
            })
            const session = yield* insertSession(tx, {
              agentId: id,
              spec,
              sessionKey: yield* newKey(tx, id, now),
              permissionId: null,
              validUntil: DateTime.add(now, { days: SESSION_DAYS }),
              createdBy: "owner",
              now
            })
            const [inserted] = yield* tx.update(agents).set({ pendingSessionId: session.id })
              .where(eq(agents.id, id)).returning()
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

      const change = Effect.fn("Agents.change")(function*(
        owner: Owner,
        id: AgentId,
        input: { readonly requestId: string; readonly spec: AgentSpec }
      ) {
        const row = yield* rowOf(owner, id)
        const existing = yield* prepared(owner, input.requestId, row, "update")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "active") return yield* new Conflict({ reason: "agentBusy" })
        const spec = complete(input.spec)
        yield* requireValid(spec)

        const current = yield* sessionRow(row.currentSessionId)
        const now = yield* DateTime.now
        const session = yield* db.transaction((tx) =>
          insertSession(tx, {
            agentId: row.id,
            spec,
            sessionKey: current.sessionKey,
            permissionId: current.permissionId,
            validUntil: current.validUntil!,
            createdBy: "owner",
            now
          })
        ).pipe(Effect.orDie)
        const { calls } = changeCalls(Grant.parse(current.grant!), decodeSpec(current.spec), spec)
        return yield* prepare(owner, row, {
          requestId: input.requestId,
          action: "update",
          sessionId: session.id,
          calls
        })
      }, Effect.provideContext(context))

      const renew = Effect.fn("Agents.renew")(function*(owner: Owner, id: AgentId, requestId: string) {
        const row = yield* rowOf(owner, id)
        const existing = yield* prepared(owner, requestId, row, "renew")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "active") return yield* new Conflict({ reason: "agentBusy" })

        const current = yield* sessionRow(row.currentSessionId)
        const now = yield* DateTime.now
        const session = yield* db.transaction((tx) =>
          Effect.gen(function*() {
            return yield* insertSession(tx, {
              agentId: row.id,
              spec: decodeSpec(current.spec),
              sessionKey: yield* newKey(tx, row.id, now),
              permissionId: null,
              validUntil: DateTime.add(now, { days: SESSION_DAYS }),
              createdBy: "owner",
              now
            })
          })
        ).pipe(Effect.orDie)
        const locked = sessionOf(session)
        yield* saveSession(session.id, { permissionId: Session.getPermissionId(locked) })
        return yield* prepare(owner, row, {
          requestId,
          action: "renew",
          sessionId: session.id,
          calls: renewCalls(Grant.parse(current.grant!), locked)
        })
      }, Effect.provideContext(context))

      const remove = Effect.fn("Agents.remove")(function*(owner: Owner, id: AgentId, requestId: string) {
        const row = yield* rowOf(owner, id)
        if (row.status === "draft") {
          return yield* save(row, { status: Result.getOrThrow(transition(row.status, { _tag: "Discarded" })) })
        }
        const existing = yield* prepared(owner, requestId, row, "remove")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "active") return yield* new Conflict({ reason: "agentBusy" })

        const current = yield* sessionRow(row.currentSessionId)
        return yield* prepare(owner, row, {
          requestId,
          action: "remove",
          calls: revokeCalls(Grant.parse(current.grant!))
        })
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
        const sessionId = action === "remove" ? row.currentSessionId! : request.payload["sessionId"]!
        yield* saveSession(sessionId, action === "remove" ? { userOpHash } : { status: "locking", userOpHash })
        const agent = yield* save(row, {
          status: next.success,
          ...(action === "update" || action === "renew"
            ? { pendingSessionId: sessionId as AgentRow["pendingSessionId"] }
            : {})
        })
        yield* track(row.id, passkey)
        return agent
      }, Effect.provideContext(context))

      const setPaused = (paused: boolean) =>
        Effect.fnUntraced(function*(owner: Owner, id: AgentId) {
          const row = yield* rowOf(owner, id)
          if (row.status === "draft" || row.status === "removed") return yield* new Conflict({ reason: "agentBusy" })
          return row.paused === paused ? yield* agentOf(row) : yield* save(row, { paused })
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
        sessions,
        usage,
        create,
        lock,
        change,
        renew,
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
