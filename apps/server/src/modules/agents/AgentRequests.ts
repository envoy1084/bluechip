import { ChainClient } from "@bluechip/chain/ChainClient"
import {
  changeCalls,
  changedGrant,
  lockCalls,
  lockedGrant,
  renewCalls,
  revokeCalls
} from "@bluechip/chain/policies/Session"
import { type Agent, type AgentAction, AgentRequest, SESSION_DAYS, transition } from "@bluechip/domain/agents/Agent"
import { Conflict, InvalidSpec, type NotFound, type SignatureRejected, type Unavailable } from "@bluechip/domain/Errors"
import type { AgentId, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { checkSpec, complete } from "@bluechip/domain/policies/Catalog"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import * as Grant from "@namera-ai/sdk/Grant"
import * as Session from "@namera-ai/sdk/Session"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import type { Hex } from "viem"
import { Database } from "../../platform/db/Database.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { IntentStore } from "../intents/IntentStore.ts"
import { SavedTemplates } from "../policies/SavedTemplates.ts"
import { OwnerOperations, type OwnerPasskey } from "../signing/OwnerOperations.ts"
import { type Owner, type SigningRequestRow, SigningRequests } from "../signing/SigningRequests.ts"
import { AgentSessions, nameraSession } from "./AgentSessions.ts"
import { type AgentRow, AgentStore } from "./AgentStore.ts"

export type AgentInput = {
  readonly requestId: string
  readonly name: string
  readonly template: string | null
  readonly spec: AgentSpec
}

/**
 * Changes to agents that the account's passkey signs. Creating one prepares its lock (an owner operation enabling a
 * Namera session compiled from its spec); a change of policies, a renewal (a new key, the same policies) or a removal
 * prepares the operation that does it; and `confirm` sends what the passkey signed. Each lock, change and renewal is a
 * session in the agent's history. Operations are followed to their receipt in the background (and again after a
 * restart); the agent then moves on (`transition`) and the owner gets `AgentChanged`.
 */
export class AgentRequests extends Context.Service<AgentRequests, {
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
}>()("@bluechip/server/AgentRequests") {
  static readonly layer = Layer.effect(
    AgentRequests,
    Effect.gen(function*() {
      const db = yield* Database
      const chain = yield* ChainClient
      const owners = yield* Accounts
      const store = yield* AgentStore
      const sessions = yield* AgentSessions
      const templates = yield* SavedTemplates
      const intents = yield* IntentStore
      const operations = yield* OwnerOperations
      const signing = yield* SigningRequests
      const scope = yield* Effect.scope

      const toRequest = Effect.fnUntraced(function*(request: SigningRequestRow, row: AgentRow) {
        return new AgentRequest({
          id: request.id as SigningRequestId,
          options: yield* signing.webAuthnOptions(request),
          action: request.payload["action"] as AgentAction,
          agent: yield* store.toAgent(row),
          deploysAccount: request.deploysAccount,
          expiresAt: request.expiresAt
        })
      })

      // The request prepared under this request id for the same agent and action, if any.
      const prepared = Effect.fnUntraced(
        function*(owner: Owner, requestId: string, row: AgentRow, action: AgentAction) {
          const existing = yield* signing.findPrepared(
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
        const created = yield* signing.create(owner, {
          requestId: request.requestId,
          kind: "agent",
          payload: {
            agentId: row.id,
            action: request.action,
            ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId })
          },
          calls: request.calls
        })
        return yield* toRequest(created, row)
      })

      // A draft's session, given a fresh 90 days, and the owner operation that locks it.
      const prepareLock = Effect.fnUntraced(function*(owner: Owner, row: AgentRow, requestId: string) {
        const draft = yield* sessions.get(row.pendingSessionId)
        const validUntil = DateTime.add(yield* DateTime.now, { days: SESSION_DAYS })
        const session = nameraSession({ ...draft, validUntil })
        yield* sessions.save(draft.id, { validUntil, permissionId: Session.getPermissionId(session) })
        return yield* prepare(owner, row, { requestId, action: "lock", sessionId: draft.id, calls: lockCalls(session) })
      })

      // What an operation that landed (or not) does to the agent and its sessions.
      const settle = Effect.fnUntraced(function*(agentId: AgentRow["id"], passkey: OwnerPasskey) {
        const row = yield* store.get(agentId)
        if (row === undefined) return
        const sending = yield* sessions.get(row.status === "removing" ? row.currentSessionId : row.pendingSessionId)
        const outcome = yield* operations.wait(passkey, sending.userOpHash as Hex).pipe(Effect.result)
        // The wait takes up to 2 minutes, and every server follows every operation in flight when it starts: act only
        // if the agent is still where it was, or this would undo what another server (or a later change) did.
        const latest = yield* store.get(agentId)
        const unchanged = latest !== undefined && latest.status === row.status &&
          latest.pendingSessionId === row.pendingSessionId && latest.currentSessionId === row.currentSessionId
        if (!unchanged) return
        const landed = outcome._tag === "Success" && outcome.success.success
        const next = transition(row.status, { _tag: landed ? "Landed" : "Failed" })
        if (Result.isFailure(next)) return yield* Effect.logWarning(`Agent ${row.id}: ${next.failure}`)

        const now = yield* DateTime.now
        if (!landed) {
          // A renewal or removal of an expired agent that failed leaves it expired: its session is still past its end.
          const current = row.currentSessionId === null ? undefined : yield* sessions.get(row.currentSessionId)
          const ended = current?.validUntil != null && DateTime.isLessThan(current.validUntil, now)
          yield* sessions.save(sending.id, {
            status: row.status === "locking"
              ? "draft"
              : row.status === "removing"
              ? (ended ? "expired" : "active")
              : "failed",
            userOpHash: null
          })
          const back = ended ? transition(next.success, { _tag: "Expired" }) : next
          return yield* store.save(row, {
            status: Result.getOrElse(back, () => next.success),
            ...(row.status === "updating" ? { pendingSessionId: null } : {})
          })
        }

        if (row.status === "removing") {
          yield* sessions.save(sending.id, { status: "revoked", endedAt: now, userOpHash: null })
          return yield* store.save(row, { status: next.success })
        }

        const current = row.currentSessionId === null ? undefined : yield* sessions.get(row.currentSessionId)
        // A change keeps the session's key and permission: its grant is the current one, changed.
        const grant = current !== undefined && current.sessionKey === sending.sessionKey ?
          changedGrant(
            Grant.parse(current.grant!),
            changeCalls(Grant.parse(current.grant!), current.spec, sending.spec).session
          ) :
          yield* lockedGrant(yield* operations.account(passkey), nameraSession(sending)).pipe(
            Effect.provideService(ChainClient, chain)
          )
        yield* sessions.save(sending.id, {
          status: "active",
          grant: Grant.serialize(grant),
          installedAt: now,
          userOpHash: null
        })
        // A renewed expired session keeps its status and end in the history.
        if (current !== undefined && current.status !== "expired") {
          yield* sessions.save(current.id, { status: "replaced", endedAt: now })
        }
        return yield* store.save(row, { status: next.success, currentSessionId: sending.id, pendingSessionId: null })
      }, Effect.catchTag("ChainError", (error) => Effect.logWarning("Agent settle failed", error)))

      const track = (agentId: AgentRow["id"], passkey: OwnerPasskey) =>
        settle(agentId, passkey).pipe(
          Effect.catch((error) => Effect.logWarning(`Agent ${agentId} settle failed`, error)),
          Effect.forkIn(scope),
          Effect.asVoid
        )

      for (const row of yield* store.inFlight) {
        yield* track(row.id, yield* owners.ownerPasskey(row.userId as UserId))
      }

      const create = Effect.fn("AgentRequests.create")(function*(owner: Owner, input: AgentInput) {
        const spec = complete(input.spec)
        yield* requireValid(spec)
        const existing = yield* signing.findPrepared(owner, input.requestId, (payload) => payload["action"] === "lock")
        if (Option.isSome(existing)) {
          const row = yield* store.owned(owner, existing.value.payload["agentId"] as AgentId)
          return yield* toRequest(existing.value, row)
        }
        if (input.template !== null) yield* templates.requireExists(owner, input.template)

        const row = yield* store.create(owner, { name: input.name, template: input.template, spec })
        return yield* prepareLock(owner, row, input.requestId)
      })

      const lock = Effect.fn("AgentRequests.lock")(function*(owner: Owner, id: AgentId, requestId: string) {
        const row = yield* store.owned(owner, id)
        const existing = yield* prepared(owner, requestId, row, "lock")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "draft") return yield* new Conflict({ reason: "agentBusy" })
        return yield* prepareLock(owner, row, requestId)
      })

      const change = Effect.fn("AgentRequests.change")(function*(
        owner: Owner,
        id: AgentId,
        input: { readonly requestId: string; readonly spec: AgentSpec }
      ) {
        const row = yield* store.owned(owner, id)
        const existing = yield* prepared(owner, input.requestId, row, "update")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "active") return yield* new Conflict({ reason: "agentBusy" })
        const spec = complete(input.spec)
        yield* requireValid(spec)

        const current = yield* sessions.get(row.currentSessionId)
        const now = yield* DateTime.now
        const session = yield* db.transaction((tx) =>
          sessions.insert(tx, {
            agentId: row.id,
            spec,
            sessionKey: current.sessionKey,
            permissionId: current.permissionId,
            validUntil: current.validUntil!,
            createdBy: "owner",
            now
          })
        ).pipe(Effect.orDie)
        const { calls } = changeCalls(Grant.parse(current.grant!), current.spec, spec)
        return yield* prepare(owner, row, {
          requestId: input.requestId,
          action: "update",
          sessionId: session.id,
          calls
        })
      })

      const renew = Effect.fn("AgentRequests.renew")(function*(owner: Owner, id: AgentId, requestId: string) {
        const row = yield* store.owned(owner, id)
        const existing = yield* prepared(owner, requestId, row, "renew")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "active" && row.status !== "expired") return yield* new Conflict({ reason: "agentBusy" })

        const current = yield* sessions.get(row.currentSessionId)
        const now = yield* DateTime.now
        const session = yield* db.transaction((tx) =>
          Effect.gen(function*() {
            return yield* sessions.insert(tx, {
              agentId: row.id,
              // Its policies, with bluechip's hidden ones as they are today (a raised gas budget, say).
              spec: complete(current.spec),
              sessionKey: yield* sessions.newKey(tx, row.id, now),
              permissionId: null,
              validUntil: DateTime.add(now, { days: SESSION_DAYS }),
              createdBy: "owner",
              now
            })
          })
        ).pipe(Effect.orDie)
        const locked = nameraSession(session)
        yield* sessions.save(session.id, { permissionId: Session.getPermissionId(locked) })
        return yield* prepare(owner, row, {
          requestId,
          action: "renew",
          sessionId: session.id,
          calls: renewCalls(Grant.parse(current.grant!), locked)
        })
      })

      const remove = Effect.fn("AgentRequests.remove")(function*(owner: Owner, id: AgentId, requestId: string) {
        const row = yield* store.owned(owner, id)
        if (row.status === "draft") {
          return yield* store.save(row, { status: Result.getOrThrow(transition(row.status, { _tag: "Discarded" })) })
        }
        const existing = yield* prepared(owner, requestId, row, "remove")
        if (Option.isSome(existing)) return existing.value
        if (row.status !== "active" && row.status !== "expired") return yield* new Conflict({ reason: "agentBusy" })

        const current = yield* sessions.get(row.currentSessionId)
        return yield* prepare(owner, row, {
          requestId,
          action: "remove",
          calls: revokeCalls(Grant.parse(current.grant!))
        })
      })

      const confirm = Effect.fn("AgentRequests.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const { passkey, request } = yield* signing.claim(owner, id, "agent", credential)
        const action = request.payload["action"] as AgentAction
        const row = yield* store.owned(owner, request.payload["agentId"] as AgentId)
        const next = transition(row.status, { _tag: "Sent", action })
        if (Result.isFailure(next)) return yield* new Conflict({ reason: "agentBusy" })

        const userOpHash = yield* operations.send(passkey, request.userOperation, credential)
        // Its trades not sent yet were decided against the policies on their way out.
        if (action !== "lock") yield* intents.cancelAgentIntents(row.id)
        const sessionId = action === "remove" ? row.currentSessionId! : request.payload["sessionId"]!
        yield* sessions.save(sessionId, action === "remove" ? { userOpHash } : { status: "locking", userOpHash })
        const agent = yield* store.save(row, {
          status: next.success,
          ...(action === "update" || action === "renew"
            ? { pendingSessionId: sessionId as AgentRow["pendingSessionId"] }
            : {})
        })
        yield* track(row.id, passkey)
        return agent
      })

      return AgentRequests.of({ create, lock, change, renew, remove, confirm })
    })
  )
}
