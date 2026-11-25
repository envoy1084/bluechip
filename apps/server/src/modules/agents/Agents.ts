import { ChainClient } from "@bluechip/chain/ChainClient"
import { readUsage } from "@bluechip/chain/policies/Usage"
import { type Agent, type AgentSession, AgentUsage } from "@bluechip/domain/agents/Agent"
import { Conflict, type NotFound, Unavailable } from "@bluechip/domain/Errors"
import type { AgentId } from "@bluechip/domain/Ids"
import * as Grant from "@namera-ai/sdk/Grant"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Address } from "viem"
import { IntentStore } from "../intents/IntentStore.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { AgentSessions, toSession } from "./AgentSessions.ts"
import { AgentStore } from "./AgentStore.ts"

/**
 * The owner's agents: what they are, what they have used of their limits, and pausing them. Pausing only stops
 * bluechip sending an agent's trades (and cancels those not sent yet); its policies stay locked onchain.
 */
export class Agents extends Context.Service<Agents, {
  readonly list: (owner: Owner) => Effect.Effect<ReadonlyArray<Agent>>
  readonly find: (owner: Owner, id: AgentId) => Effect.Effect<Agent, NotFound>
  /** The agent's sessions: each lock, change and renewal of its policies. */
  readonly sessions: (owner: Owner, id: AgentId) => Effect.Effect<ReadonlyArray<AgentSession>, NotFound>
  /** What the agent has used of its limits, read from its policies onchain. */
  readonly usage: (owner: Owner, id: AgentId) => Effect.Effect<AgentUsage, NotFound | Unavailable>
  readonly pause: (owner: Owner, id: AgentId) => Effect.Effect<Agent, NotFound | Conflict>
  readonly resume: (owner: Owner, id: AgentId) => Effect.Effect<Agent, NotFound | Conflict>
  readonly pauseAll: (owner: Owner) => Effect.Effect<ReadonlyArray<Agent>>
  readonly resumeAll: (owner: Owner) => Effect.Effect<ReadonlyArray<Agent>>
}>()("@bluechip/server/Agents") {
  static readonly layer = Layer.effect(
    Agents,
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const store = yield* AgentStore
      const agentSessions = yield* AgentSessions
      const intents = yield* IntentStore

      const find = Effect.fn("Agents.find")(function*(owner: Owner, id: AgentId) {
        return yield* store.toAgent(yield* store.owned(owner, id))
      })

      const sessions = Effect.fn("Agents.sessions")(function*(owner: Owner, id: AgentId) {
        const row = yield* store.owned(owner, id)
        const rows = yield* agentSessions.ofAgents([row.id])
        // Changes prepared but never signed stay out of the history.
        return rows.filter((session) => session.status !== "draft" || session.id === row.pendingSessionId)
          .map(toSession)
      })

      const usage = Effect.fn("Agents.usage")(function*(owner: Owner, id: AgentId) {
        const row = yield* store.owned(owner, id)
        if (row.currentSessionId === null || row.status === "removed") return new AgentUsage({ policies: [] })

        const current = yield* agentSessions.get(row.currentSessionId)
        const policies = yield* readUsage({
          spec: current.spec,
          account: owner.account as Address,
          grant: Grant.parse(current.grant!),
          now: Math.floor(DateTime.toEpochMillis(yield* DateTime.now) / 1000)
        }).pipe(
          Effect.provideService(ChainClient, chain),
          Effect.catchTag(
            "ChainError",
            () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }))
          )
        )
        return new AgentUsage({ policies })
      })

      const setPaused = (paused: boolean) =>
        Effect.fnUntraced(function*(owner: Owner, id: AgentId) {
          const row = yield* store.owned(owner, id)
          if (row.status === "draft" || row.status === "removed") return yield* new Conflict({ reason: "agentBusy" })
          if (row.paused === paused) return yield* store.toAgent(row)
          if (paused) yield* intents.cancelAgentIntents(row.id)
          return yield* store.save(row, { paused })
        })

      const setAllPaused = (paused: boolean) =>
        Effect.fnUntraced(function*(owner: Owner) {
          for (const row of yield* store.running(owner, !paused)) {
            if (paused) yield* intents.cancelAgentIntents(row.id)
            yield* store.save(row, { paused })
          }
          return yield* store.list(owner)
        })

      return Agents.of({
        list: store.list,
        find,
        sessions,
        usage,
        pause: Effect.fn("Agents.pause")(setPaused(true)),
        resume: Effect.fn("Agents.resume")(setPaused(false)),
        pauseAll: Effect.fn("Agents.pauseAll")(setAllPaused(true)),
        resumeAll: Effect.fn("Agents.resumeAll")(setAllPaused(false))
      })
    })
  )
}
