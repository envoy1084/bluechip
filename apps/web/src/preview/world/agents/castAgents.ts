// A cast agent as it would be after the days it has lived: locked with a template's earlier preset, changed to the
// cast's, a change that failed and renewals for long-lived ones (one after its session ran out), then put in its
// cast state. Usage and the journal's trades follow its template.
import { SESSION_DAYS } from "@bluechip/domain/agents/Agent"
import { limitsOf } from "@bluechip/domain/automations/AgentLimits"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import { draftSpec, type Preset } from "@bluechip/domain/policies/Templates"
import * as DateTime from "effect/DateTime"
import type { CastAgent } from "../cast.ts"
import { type AgentRecord, type IdCounter, saveSession, sessionOf, type UsageLimit } from "./AgentRecord.ts"
import { addSession, changedSpec, setAgentState } from "./AgentStates.ts"
import { tradeHistory } from "./journal.ts"

const EARLIER: Readonly<Record<Preset, Preset>> = {
  conservative: "balanced",
  balanced: "conservative",
  active: "balanced"
}

/** What a new agent has used today, by its template. */
const usageFor = (template: string | null): Record<UsageLimit, number> =>
  template === "rebalancer" ?
    { trade: 0.45, tradesPerDay: 0.02, gasBudget: 0.3, slippageBudget: 0.6 } :
    template === "stopLossGuard" ?
    { trade: 0, tradesPerDay: 0.004, gasBudget: 0.05, slippageBudget: 0.1 } :
    { trade: 0.3, tradesPerDay: 0.01, gasBudget: 0.1, slippageBudget: 0.2 }

// Locks `spec` again with a new key at `at`: the session before it replaced, or expired if it had run out.
const renew = (ids: IdCounter, record: AgentRecord, at: DateTime.Utc) => {
  const current = sessionOf(record, record.currentSessionId)!
  const ranOut = DateTime.isLessThan(current.validUntil!, at)
  saveSession(record, current.id, {
    status: ranOut ? "expired" : "replaced",
    endedAt: ranOut ? current.validUntil : at
  })
  record.currentSessionId = addSession(ids, record, {
    status: "active",
    spec: complete(current.spec),
    createdBy: "owner",
    validUntil: DateTime.add(at, { days: SESSION_DAYS }),
    createdAt: at,
    installedAt: DateTime.add(at, { minutes: 1 }),
    endedAt: null
  })
}

/** The cast agent with its history, as of `now`. */
export const castAgent = (ids: IdCounter, cast: CastAgent, now: DateTime.Utc): AgentRecord => {
  const spec: AgentSpec = draftSpec(cast)
  const earlier = draftSpec({ ...cast, preset: EARLIER[cast.preset] })
  const createdAt = DateTime.subtract(now, { days: cast.ageDays, hours: 3 })
  const record: AgentRecord = {
    id: cast.id,
    name: cast.name,
    template: cast.template,
    status: "active",
    paused: false,
    createdAt,
    sessions: [],
    currentSessionId: null,
    pendingSessionId: null,
    usage: usageFor(cast.template),
    journal: []
  }
  const changes = cast.ageDays >= 7

  record.currentSessionId = addSession(ids, record, {
    status: "active",
    spec: changes ? earlier : spec,
    createdBy: "owner",
    validUntil: DateTime.add(createdAt, { days: SESSION_DAYS }),
    createdAt,
    installedAt: DateTime.add(createdAt, { minutes: 2 }),
    endedAt: null
  })

  if (changes) {
    const changedAt = DateTime.add(createdAt, { days: Math.min(60, Math.round(cast.ageDays * 0.45)) })
    const first = sessionOf(record, record.currentSessionId)!
    saveSession(record, first.id, { status: "replaced", endedAt: changedAt })
    record.currentSessionId = addSession(ids, record, {
      status: "active",
      spec,
      createdBy: cast.ageDays >= 20 ? "assistant" : "owner",
      validUntil: first.validUntil,
      createdAt: changedAt,
      installedAt: DateTime.add(changedAt, { minutes: 1 }),
      endedAt: null
    })

    if (cast.ageDays >= 30) {
      addSession(ids, record, {
        status: "failed",
        spec: changedSpec(spec),
        createdBy: "owner",
        validUntil: first.validUntil,
        createdAt: DateTime.add(changedAt, { days: 3 }),
        installedAt: null,
        endedAt: null
      })
    }
  }

  // Renewed before its end, or (a long-lived one, the first time) a few days after it ran out; an agent left expired
  // never was.
  let late = cast.ageDays >= 100
  while (cast.state !== "expired") {
    const current = sessionOf(record, record.currentSessionId)!
    const at = DateTime.subtract(current.validUntil!, { days: late ? -5 : 10 })
    if (!DateTime.isLessThan(at, DateTime.subtract(now, { days: 1 }))) break
    renew(ids, record, at)
    late = false
  }

  setAgentState(ids, record, cast.state === "asking" ? "active" : cast.state, now)
  if (cast.state === "removed") {
    saveSession(record, record.currentSessionId!, { endedAt: DateTime.subtract(now, { days: 12 }) })
  }

  // It trades until it stopped: its session's end, its removal, or a couple of days before you paused it.
  const current = sessionOf(record, record.currentSessionId)
  const until = cast.state === "expired" || cast.state === "removed" ?
    current!.endedAt! :
    cast.state === "paused" ?
    DateTime.subtract(now, { days: 2 }) :
    now
  record.journal = current === undefined
    ? []
    : tradeHistory(ids, record, { limits: limitsOf(spec)!, from: createdAt, until })
  return record
}
