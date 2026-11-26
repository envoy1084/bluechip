// Moving a preview agent between the states its pages show, keeping its history sensible: what a lock, change,
// renewal or removal does to its sessions when it is sent and when it lands, as the server's `AgentRequests` does, and
// the panel's jumps straight into any state.
import { type AgentAction, AgentSession, type AgentStatus, SESSION_DAYS } from "@bluechip/domain/agents/Agent"
import type { AgentSessionId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { AgentSpec, type PolicyEntry } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import * as DateTime from "effect/DateTime"
import { type AgentRecord, type IdCounter, nextId, saveSession, sessionOf } from "./AgentRecord.ts"

/** Every state the panel can put an agent in. */
export const AGENT_STATES = [
  { value: "active", label: "Active" },
  { value: "doneForToday", label: "Done for today" },
  { value: "paused", label: "Paused" },
  { value: "draft", label: "Draft, not locked" },
  { value: "locking", label: "Locking" },
  { value: "updating", label: "Updating (new rules)" },
  { value: "renewing", label: "Renewing" },
  { value: "removing", label: "Removing" },
  { value: "expired", label: "Expired" },
  { value: "removed", label: "Removed" }
] as const

export type AgentState = (typeof AGENT_STATES)[number]["value"]

/** A new session of the agent's, added to its history. */
export const addSession = (
  ids: IdCounter,
  record: AgentRecord,
  session: Omit<ConstructorParameters<typeof AgentSession>[0], "id">
): AgentSessionId => {
  const id = nextId(ids, "agentsession") as AgentSessionId
  record.sessions.push(new AgentSession({ id, ...session }))
  return id
}

/**
 * The spec a change locks: half the daily budget (its largest trade no bigger), and the other weekly slippage
 * budget, so a sell-only agent's change differs too.
 */
export const changedSpec = (spec: AgentSpec): AgentSpec => {
  const budget = configOf(spec.policies, trade)?.dailyBudget ?? BigInt(0)
  const half = Usdc.make(budget / BigInt(2))

  return complete(
    new AgentSpec({
      policies: spec.policies.map((entry): PolicyEntry => {
        switch (entry.id) {
          case "trade":
            return { ...entry, config: { ...entry.config, dailyBudget: half } }
          case "tradeSize":
            return half > BigInt(0) && half < entry.config.maxPerTrade ?
              { ...entry, config: { ...entry.config, maxPerTrade: half } } :
              entry
          case "slippageBudget":
            return { ...entry, config: { weeklyBps: entry.config.weeklyBps === 100 ? 50 : 100 } }
          default:
            return entry
        }
      })
    })
  )
}

const inForce = (record: AgentRecord) =>
  (sessionOf(record, record.currentSessionId) ?? sessionOf(record, record.pendingSessionId))!

/** What landing a lock, change or renewal does: the session on its way is in force, the one before it replaced. */
export const land = (record: AgentRecord, now: DateTime.Utc): "landed" | "renewed" | "removed" => {
  if (record.status === "removing") {
    saveSession(record, record.currentSessionId!, { status: "revoked", endedAt: now })
    record.status = "removed"
    return "removed"
  }

  const current = sessionOf(record, record.currentSessionId)
  const pending = sessionOf(record, record.pendingSessionId)!
  const renewed = current !== undefined && !DateTime.Equivalence(current.validUntil!, pending.validUntil!)
  if (current !== undefined && current.status !== "expired") {
    saveSession(record, current.id, { status: "replaced", endedAt: now })
  }
  saveSession(record, pending.id, { status: "active", installedAt: now })
  record.currentSessionId = pending.id
  record.pendingSessionId = null
  record.status = "active"
  return renewed ? "renewed" : "landed"
}

/**
 * What sending a signed operation does to the agent: it moves on (`transition` allowed it) and the session it locks
 * (`sessionId`, none for a removal) is on its way.
 */
export const send = (
  record: AgentRecord,
  action: AgentAction,
  status: AgentStatus,
  sessionId: AgentSessionId | null
) => {
  if (sessionId !== null) {
    saveSession(record, sessionId, { status: "locking" })
    if (action !== "lock") record.pendingSessionId = sessionId
  }
  record.status = status
}

/**
 * Prepares a change (`spec`) or a renewal (its policies, 90 more days) as a draft session, as the server does; it is
 * the agent's change on its way only once sent.
 */
export const prepareSession = (
  ids: IdCounter,
  record: AgentRecord,
  now: DateTime.Utc,
  change: { readonly spec: AgentSpec } | "renew"
): AgentSessionId => {
  const current = sessionOf(record, record.currentSessionId)!
  return addSession(ids, record, {
    status: "draft",
    spec: change === "renew" ? complete(current.spec) : change.spec,
    createdBy: "owner",
    validUntil: change === "renew" ? DateTime.add(now, { days: SESSION_DAYS }) : current.validUntil,
    createdAt: now,
    installedAt: null,
    endedAt: null
  })
}

// Locked and in force at `now`, keeping its history: a draft's session lands, an expired or removed agent is renewed.
const ensureLocked = (ids: IdCounter, record: AgentRecord, now: DateTime.Utc) => {
  const current = sessionOf(record, record.currentSessionId)
  const pending = sessionOf(record, record.pendingSessionId)
  if (current !== undefined && pending !== undefined) {
    record.sessions = record.sessions.filter((session) => session.id !== pending.id)
    record.pendingSessionId = null
  }

  if (current === undefined) {
    const at = DateTime.subtract(now, { minutes: 5 })
    saveSession(record, pending!.id, {
      status: "active",
      validUntil: DateTime.add(at, { days: SESSION_DAYS }),
      installedAt: at
    })
    record.currentSessionId = pending!.id
    record.pendingSessionId = null
  } else if (current.status !== "active") {
    const at = DateTime.subtract(now, { hours: 1 })
    record.currentSessionId = addSession(ids, record, {
      status: "active",
      spec: complete(current.spec),
      createdBy: "owner",
      validUntil: DateTime.add(at, { days: SESSION_DAYS }),
      createdAt: at,
      installedAt: at,
      endedAt: null
    })
  }
  record.status = "active"
}

// Not locked: one session with its policies, a draft or on its way.
const unlocked = (ids: IdCounter, record: AgentRecord, now: DateTime.Utc, status: "draft" | "locking") => {
  const spec = inForce(record).spec
  record.sessions = []
  record.currentSessionId = null
  record.pendingSessionId = addSession(ids, record, {
    status,
    spec,
    createdBy: "owner",
    validUntil: DateTime.add(now, { days: SESSION_DAYS }),
    createdAt: record.createdAt,
    installedAt: null,
    endedAt: null
  })
  record.status = status
  record.paused = false
}

/** Puts the agent straight into `state`, as of `now`. */
export const setAgentState = (ids: IdCounter, record: AgentRecord, state: AgentState, now: DateTime.Utc) => {
  if (state === "draft" || state === "locking") return unlocked(ids, record, now, state)

  ensureLocked(ids, record, now)
  const current = sessionOf(record, record.currentSessionId)!
  record.paused = state === "paused"
  if (state === "doneForToday") record.usage = { ...record.usage, trade: 1 }
  else if (record.usage.trade >= 1) record.usage = { ...record.usage, trade: 0 }

  switch (state) {
    case "updating":
    case "renewing": {
      const sessionId = prepareSession(
        ids,
        record,
        DateTime.subtract(now, { minutes: 1 }),
        state === "renewing" ? "renew" : { spec: changedSpec(current.spec) }
      )
      send(record, state === "renewing" ? "renew" : "update", "updating", sessionId)
      return
    }
    case "removing":
      record.status = "removing"
      return
    case "expired": {
      const ended = DateTime.isLessThan(current.validUntil!, now)
        ? current.validUntil!
        : DateTime.subtract(now, { days: 2 })
      saveSession(record, current.id, { status: "expired", validUntil: ended, endedAt: ended })
      record.status = "expired"
      return
    }
    case "removed":
      saveSession(record, current.id, { status: "revoked", endedAt: DateTime.subtract(now, { hours: 1 }) })
      record.status = "removed"
      return
  }
}

/** The state the panel shows it in. */
export const agentStateOf = (record: AgentRecord): AgentState => {
  switch (record.status) {
    case "draft":
    case "locking":
    case "removing":
    case "expired":
    case "removed":
      return record.status
    case "updating": {
      const current = sessionOf(record, record.currentSessionId)
      const pending = sessionOf(record, record.pendingSessionId)
      return current !== undefined && pending !== undefined &&
          !DateTime.Equivalence(current.validUntil!, pending.validUntil!) ?
        "renewing" :
        "updating"
    }
    case "active":
      return record.paused ? "paused" : record.usage.trade >= 1 ? "doneForToday" : "active"
  }
}
