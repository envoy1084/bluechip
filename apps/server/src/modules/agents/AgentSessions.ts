import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import type { Deployment } from "@bluechip/chain/Deployment"
import { agentKey, agentSession, placements } from "@bluechip/chain/policies/Session"
import { AgentSession, type SessionAuthor } from "@bluechip/domain/agents/Agent"
import type { AgentSessionId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import type * as Session from "@namera-ai/sdk/Session"
import { asc, eq, inArray } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { type Address, keccak256, type LocalAccount, stringToHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { AppConfig } from "../../config/AppConfig.ts"
import { Database } from "../../platform/db/Database.ts"
import { decryptKey, newAgentKey } from "./Keys.ts"
import { agentSessions, sessionKeys, sessionPolicies } from "./tables.ts"

export type SessionRow = typeof agentSessions.$inferSelect

/** A database transaction, for writes that go with the agent's own. */
type Transaction = Parameters<Parameters<Database["Service"]["transaction"]>[0]>[0]

/** A session as the API returns it: its key, grant and operation stay on the server. */
export const toSession = (row: SessionRow): AgentSession =>
  new AgentSession({
    id: row.id as AgentSessionId,
    status: row.status,
    spec: row.spec,
    createdBy: row.createdBy,
    validUntil: row.validUntil,
    createdAt: row.createdAt,
    installedAt: row.installedAt,
    endedAt: row.endedAt
  })

/**
 * The Namera session a session row locks: its spec's policies, signed by its key, until its end, for its agent (every
 * session of one agent shares the day's budget onchain). The salt comes from the row, so building it again (to read its
 * grant once locked) gives the same permission id.
 */
export const nameraSession = (deployment: Deployment, row: SessionRow): Session.Session =>
  agentSession({
    deployment,
    spec: row.spec,
    agent: agentKey(row.agentId),
    signer: row.sessionKey as Address,
    validUntil: Math.floor(DateTime.toEpochMillis(row.validUntil!) / 1000),
    salt: keccak256(stringToHex(row.id))
  })

/**
 * Agents' sessions (each lock, change and renewal of an agent's policies) and their keys, sealed at rest with
 * `AGENT_KEY_ENCRYPTION_KEY`.
 */
export class AgentSessions extends Context.Service<AgentSessions, {
  /** A new draft session of `spec` for an agent, with a row per policy saying where it is enforced. */
  readonly insert: (tx: Transaction, session: {
    readonly agentId: `agent_${string}`
    readonly spec: AgentSpec
    readonly sessionKey: string
    readonly permissionId: string | null
    readonly validUntil: DateTime.Utc
    readonly createdBy: SessionAuthor
    readonly now: DateTime.Utc
  }) => Effect.Effect<SessionRow, unknown>
  /** A new key for the agent; returns its address. */
  readonly newKey: (tx: Transaction, agentId: `agent_${string}`, now: DateTime.Utc) => Effect.Effect<Address, unknown>
  /** Every session of these agents, oldest first. */
  readonly ofAgents: (agentIds: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<SessionRow>>
  /** A session by id. */
  readonly get: (id: string | null) => Effect.Effect<SessionRow>
  /** Saves changes to a session. */
  readonly save: (id: string, changes: Partial<SessionRow>) => Effect.Effect<void>
  /** The session's key, as the agent's signer. */
  readonly signer: (agentId: string, session: SessionRow) => Effect.Effect<LocalAccount>
}>()("@bluechip/server/AgentSessions") {
  static readonly layer = Layer.effect(
    AgentSessions,
    Effect.gen(function*() {
      const db = yield* Database
      const config = yield* AppConfig
      const deployment = yield* ChainDeployment

      const insert = Effect.fn("AgentSessions.insert")(function*(tx: Transaction, session: {
        readonly agentId: `agent_${string}`
        readonly spec: AgentSpec
        readonly sessionKey: string
        readonly permissionId: string | null
        readonly validUntil: DateTime.Utc
        readonly createdBy: SessionAuthor
        readonly now: DateTime.Utc
      }) {
        const id = typeid("agentsession").toString() as `agentsession_${string}`
        const [row] = yield* tx.insert(agentSessions).values({
          id,
          agentId: session.agentId,
          spec: session.spec,
          sessionKey: session.sessionKey,
          permissionId: session.permissionId,
          validUntil: session.validUntil,
          status: "draft",
          createdBy: session.createdBy,
          createdAt: session.now
        }).returning()

        yield* tx.insert(sessionPolicies).values(
          placements(deployment, session.spec).map((placement, position) => ({
            sessionId: id,
            position,
            policy: placement.policy,
            kind: placement.kind,
            contract: placement.contract
          }))
        )
        return row!
      })

      const newKey = Effect.fn("AgentSessions.newKey")(
        function*(tx: Transaction, agentId: `agent_${string}`, now: DateTime.Utc) {
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

      const ofAgents = Effect.fn("AgentSessions.ofAgents")(function*(agentIds: ReadonlyArray<string>) {
        if (agentIds.length === 0) return [] as ReadonlyArray<SessionRow>
        return yield* db.select().from(agentSessions)
          .where(inArray(agentSessions.agentId, agentIds as Array<`agent_${string}`>))
          .orderBy(asc(agentSessions.createdAt)).pipe(Effect.orDie)
      })

      const get = Effect.fn("AgentSessions.get")(function*(id: string | null) {
        const [row] = yield* db.select().from(agentSessions)
          .where(eq(agentSessions.id, id as `agentsession_${string}`)).pipe(Effect.orDie)
        return row!
      })

      const save = Effect.fn("AgentSessions.save")(function*(id: string, changes: Partial<SessionRow>) {
        yield* db.update(agentSessions).set(changes).where(eq(agentSessions.id, id as `agentsession_${string}`))
          .pipe(Effect.orDie)
      })

      const signer = Effect.fn("AgentSessions.signer")(function*(agentId: string, session: SessionRow) {
        const [key] = yield* db.select().from(sessionKeys).where(eq(sessionKeys.address, session.sessionKey)).pipe(
          Effect.orDie
        )
        return privateKeyToAccount(decryptKey(config.agentKeyEncryptionKey, agentId, key!.ciphertext))
      })

      return AgentSessions.of({ insert, newKey, ofAgents, get, save, signer })
    })
  )
}
