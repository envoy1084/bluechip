// A cast agent as it would be after the days it has lived: locked with a template's earlier preset, changed to the
// cast's, a change that failed and renewals for long-lived ones (one after its session ran out), then put in its
// cast state. Its journal's trades and today's usage are the market's trades through it, so its journal, history,
// results and usage count the same ones.
import { SESSION_DAYS } from "@bluechip/domain/agents/Agent"
import type { JournalEntryId } from "@bluechip/domain/Ids"
import { JournalEntry, journalOfIntent } from "@bluechip/domain/journal/Journal"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { draftSpec, type Preset } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import type { Trade } from "@bluechip/domain/trading/Trade"
import * as DateTime from "effect/DateTime"
import type { CastAgent } from "../cast.ts"
import type { IntentRecord, MarketSlice } from "../market/model.ts"
import { type AgentRecord, type IdCounter, saveSession, sessionOf, type UsageLimit } from "./AgentRecord.ts"
import { addSession, changedSpec, setAgentState } from "./AgentStates.ts"
import { stockName } from "./stockName.ts"

const EARLIER: Readonly<Record<Preset, Preset>> = {
  conservative: "balanced",
  balanced: "conservative",
  active: "balanced"
}

/** What a new agent has used of its gas and this week's slippage, by its template; its trades count the rest. */
const usageFor = (template: string | null): Record<UsageLimit, number> =>
  template === "rebalancer" ?
    { trade: 0, tradesPerDay: 0, gasBudget: 0.3, slippageBudget: 0.6 } :
    template === "stopLossGuard" ?
    { trade: 0, tradesPerDay: 0, gasBudget: 0.05, slippageBudget: 0.1 } :
    { trade: 0, tradesPerDay: 0, gasBudget: 0.1, slippageBudget: 0.2 }

const DAY = 86_400_000

// Today's share of its daily budget and trades, from its trades that filled since midnight UTC.
const usedToday = (
  spec: AgentSpec,
  trades: ReadonlyArray<Trade>,
  now: DateTime.Utc
): Pick<Record<UsageLimit, number>, "trade" | "tradesPerDay"> => {
  const midnight = Math.floor(DateTime.toEpochMillis(now) / DAY) * DAY
  const today = trades.filter((fill) => fill.status === "filled" && DateTime.toEpochMillis(fill.createdAt) >= midnight)
  const spent = today.filter((fill) => fill.side === "buy").reduce((sum, fill) => sum + Number(fill.usdc), 0)
  const budget = Number(configOf(spec.policies, trade)?.dailyBudget ?? BigInt(0))
  const count = configOf(spec.policies, tradesPerDay)?.count ?? 0
  return { trade: budget === 0 ? 0 : spent / budget, tradesPerDay: count === 0 ? 0 : today.length / count }
}

// Its intents as its journal tells them, each at its last change.
const journalOf = (record: AgentRecord, intents: ReadonlyArray<IntentRecord>): Array<JournalEntry> =>
  intents.flatMap(({ intent }) => {
    const entry = intent.agentId === record.id ? journalOfIntent(intent, stockName) : undefined
    if (entry === undefined) return []
    return [
      new JournalEntry({
        id: `journal_${intent.id.slice(intent.id.indexOf("_") + 1)}` as JournalEntryId,
        agentId: record.id,
        at: intent.updatedAt,
        kind: "intent",
        entry,
        refs: { intentId: intent.id }
      })
    ]
  })

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
export const castAgent = (
  ids: IdCounter,
  cast: CastAgent,
  now: DateTime.Utc,
  market: Pick<MarketSlice, "intents" | "trades">
): AgentRecord => {
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

  record.journal = journalOf(record, market.intents)
  const today = usedToday(
    spec,
    market.trades.map((each) => each.trade).filter((fill) => fill.agentId === record.id),
    now
  )
  record.usage = {
    ...record.usage,
    trade: Math.max(record.usage.trade, today.trade),
    tradesPerDay: Math.max(record.usage.tradesPerDay, today.tradesPerDay)
  }
  return record
}
