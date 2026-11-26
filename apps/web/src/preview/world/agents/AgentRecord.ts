// An agent as the preview keeps it, the way the server's tables do: its row (status, pause, the session in force and
// the one on its way), its sessions, what it has used today and its journal. The API's `Agent` is read from it.
import {
  Agent,
  type AgentAction,
  AgentSession,
  type AgentStatus,
  AgentUsage,
  PolicyUsage
} from "@bluechip/domain/agents/Agent"
import type { AgentId, AgentSessionId, SigningRequestId } from "@bluechip/domain/Ids"
import type { JournalEntry } from "@bluechip/domain/journal/Journal"
import { gasBudget } from "@bluechip/domain/policies/GasBudget"
import { configOf } from "@bluechip/domain/policies/Policy"
import { slippageBudget } from "@bluechip/domain/policies/SlippageBudget"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import type * as DateTime from "effect/DateTime"
import { previewId } from "../ids.ts"

/** The limits an agent's usage counts. */
export type UsageLimit = "trade" | "tradesPerDay" | "gasBudget" | "slippageBudget"

export interface AgentRecord {
  readonly id: AgentId
  name: string
  template: string | null
  status: AgentStatus
  paused: boolean
  readonly createdAt: DateTime.Utc
  /** Oldest first. */
  sessions: Array<AgentSession>
  currentSessionId: AgentSessionId | null
  pendingSessionId: AgentSessionId | null
  /** The share of each limit used, 0 to 1: today's, or the week's for slippage (of its weekly budget). */
  usage: Record<UsageLimit, number>
  /** Newest first. */
  journal: Array<JournalEntry>
}

/** A lock, change, renewal or removal prepared for the passkey, or the removal of every agent at once. */
export type SigningRequest =
  | {
    readonly kind: "agent"
    readonly id: SigningRequestId
    readonly requestId: string
    readonly agentId: AgentId
    readonly action: AgentAction
    /** The session it locks: the draft's, the change's or the renewal's; none for a removal. */
    readonly sessionId: AgentSessionId | null
    readonly expiresAt: DateTime.Utc
  }
  | {
    readonly kind: "agents"
    readonly id: SigningRequestId
    readonly requestId: string
    readonly agentIds: ReadonlyArray<AgentId>
    readonly expiresAt: DateTime.Utc
  }

/** The slice's id counter: every record it makes takes the next number, the same on every load. */
export interface IdCounter {
  next: number
}

export const nextId = <P extends string>(ids: IdCounter, prefix: P): `${P}_${string}` => previewId(prefix, ids.next++)

export const sessionOf = (record: AgentRecord, id: AgentSessionId | null): AgentSession | undefined =>
  id === null ? undefined : record.sessions.find((session) => session.id === id)

/** Replaces one of its sessions with `changes` applied. */
export const saveSession = (
  record: AgentRecord,
  id: AgentSessionId,
  changes: Partial<ConstructorParameters<typeof AgentSession>[0]>
) => {
  record.sessions = record.sessions.map((session) =>
    session.id === id ? new AgentSession({ ...session, ...changes }) : session
  )
}

/** The agent as the API returns it: the policies in force (a draft's to lock), the change on its way, its end. */
export const toAgent = (record: AgentRecord): Agent => {
  const current = sessionOf(record, record.currentSessionId)
  const pending = sessionOf(record, record.pendingSessionId)
  const inForce = current ?? pending!

  return new Agent({
    id: record.id,
    name: record.name,
    template: record.template,
    status: record.status,
    paused: record.paused,
    spec: inForce.spec,
    pendingSpec: current !== undefined && pending !== undefined ? pending.spec : null,
    lockedUntil: current?.validUntil ?? null,
    createdAt: record.createdAt
  })
}

const share = (limit: bigint, used: number): bigint => BigInt(Math.round(Number(limit) * Math.min(1, used)))

/**
 * What it has used, read from its session as the server reads it from Base: nothing without a session; else its
 * daily budget, trades and gas, and what it lost to prices this week (`portfolioUsdc` sets the weekly budget's size).
 */
export const usageOf = (record: AgentRecord, portfolioUsdc: bigint): AgentUsage => {
  const current = sessionOf(record, record.currentSessionId)
  if (current === undefined || record.status === "removed") return new AgentUsage({ policies: [] })

  const { policies } = current.spec
  const budget = configOf(policies, trade)?.dailyBudget ?? BigInt(0)
  const weekly = configOf(policies, slippageBudget)
  const trades = BigInt(configOf(policies, tradesPerDay)?.count ?? 0)
  const gas = configOf(policies, gasBudget)?.weiPerDay ?? null

  return new AgentUsage({
    policies: [
      new PolicyUsage({ policy: "trade", unit: "usd", used: share(budget, record.usage.trade), limit: budget }),
      ...(weekly === undefined ? [] : [
        new PolicyUsage({
          policy: "slippageBudget",
          unit: "usd",
          used: share(portfolioUsdc * BigInt(weekly.weeklyBps) / BigInt(10_000), record.usage.slippageBudget),
          limit: null
        })
      ]),
      new PolicyUsage({
        policy: "tradesPerDay",
        unit: "count",
        used: share(trades, record.usage.tradesPerDay),
        limit: trades
      }),
      new PolicyUsage({
        policy: "gasBudget",
        unit: "wei",
        used: gas === null ? BigInt(0) : share(gas, record.usage.gasBudget),
        limit: gas
      })
    ]
  })
}
