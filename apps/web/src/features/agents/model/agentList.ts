// The agents list: each agent as the list reads it, the filters with their counts, the search and the sorts.
import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import * as DateTime from "effect/DateTime"
import { type AgentDisplayState, agentState } from "./agentState.ts"

/** One agent as the list reads it: its state, today's usage, its last filled trade and its approvals waiting. */
export interface ListedAgent {
  readonly agent: Agent
  readonly state: AgentDisplayState
  /** `undefined` for an agent with no session, or while it loads. */
  readonly usage: AgentUsage | undefined
  /** When its last trade filled: `null` when it has none, `undefined` while it loads. */
  readonly lastTradeAt: Date | null | undefined
  readonly awaiting: number
}

/**
 * The agent as the list shows it: its state, except that a running agent with a trade waiting for your approval
 * needs it.
 */
export const listedAgent = (
  agent: Agent,
  now: Date,
  read: {
    readonly usage?: AgentUsage
    readonly lastTradeAt?: Date | null | undefined
    readonly awaiting?: number
  } = {}
): ListedAgent => {
  const awaiting = read.awaiting ?? 0
  const state = agentState(agent, now, read.usage)
  return {
    agent,
    state: awaiting > 0 && (state === "active" || state === "stopped") ? "needs-approval" : state,
    usage: read.usage,
    lastTradeAt: read.lastTradeAt,
    awaiting
  }
}

export type AgentFilter = "all" | "active" | "attention" | "paused" | "drafts" | "expired"

export const AGENT_FILTERS: ReadonlyArray<{ readonly value: AgentFilter; readonly label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "attention", label: "Needs attention" },
  { value: "paused", label: "Paused" },
  { value: "drafts", label: "Drafts" },
  { value: "expired", label: "Ran out" }
]

/**
 * Whether the filter shows it. Active is every agent that may trade (done for today, waiting for you, a change on its
 * way); a draft is one not locked yet, or on its way to Base for the first time. Needs attention is what waits for
 * you: an approval, or a session that ran out.
 */
export const shows = (listed: ListedAgent, filter: AgentFilter): boolean => {
  const { agent, state } = listed
  switch (filter) {
    case "all":
      return true
    case "active":
      return state === "active" || state === "stopped" || state === "needs-approval" ||
        (state === "sending" && agent.status !== "locking")
    case "attention":
      return state === "needs-approval" || state === "expired"
    case "paused":
      return state === "paused"
    case "drafts":
      return state === "unlocked" || (state === "sending" && agent.status === "locking")
    case "expired":
      return state === "expired"
  }
}

/** How many agents each filter shows. */
export const filterCounts = (listed: ReadonlyArray<ListedAgent>): Readonly<Record<AgentFilter, number>> =>
  Object.fromEntries(
    AGENT_FILTERS.map(({ value }) => [value, listed.filter((each) => shows(each, value)).length])
  ) as Record<AgentFilter, number>

/** The stocks it trades, in its own order; none when it trades nothing yet. */
export const stocksOf = (agent: Pick<Agent, "spec">): ReadonlyArray<StockSymbol> =>
  configOf(agent.spec.policies, trade)?.stocks ?? []

/** Whether `query` finds it: in its name, or in a stock's symbol or name, ignoring case. Every agent for no query. */
export const matches = (
  agent: Pick<Agent, "name" | "spec">,
  query: string,
  nameOf: (symbol: StockSymbol) => string
): boolean => {
  const wanted = query.trim().toLowerCase()
  if (wanted === "") return true

  return [agent.name, ...stocksOf(agent).flatMap((symbol) => [symbol, nameOf(symbol)])]
    .some((text) => text.toLowerCase().includes(wanted))
}

export type AgentSort = "recent" | "name" | "spent"

export const AGENT_SORTS: ReadonlyArray<{ readonly value: AgentSort; readonly label: string }> = [
  { value: "recent", label: "Recent activity" },
  { value: "name", label: "Name" },
  { value: "spent", label: "Spent today" }
]

const lastActive = (listed: ListedAgent): number =>
  listed.lastTradeAt?.getTime() ?? DateTime.toEpochMillis(listed.agent.createdAt)

const spentToday = (listed: ListedAgent): bigint =>
  listed.usage?.policies.find((counted) => counted.policy === "trade")?.used ?? BigInt(0)

const byName = (a: ListedAgent, b: ListedAgent) => a.agent.name.localeCompare(b.agent.name)

/**
 * The agents in `sort` order: the latest trade first (an agent that never traded by when it was made), by name, or
 * the most spent today first. Ties go by name.
 */
export const sortAgents = (listed: ReadonlyArray<ListedAgent>, sort: AgentSort): ReadonlyArray<ListedAgent> =>
  listed.toSorted((a, b) => {
    switch (sort) {
      case "recent":
        return lastActive(b) - lastActive(a) || byName(a, b)
      case "name":
        return byName(a, b)
      case "spent": {
        const [left, right] = [spentToday(a), spentToday(b)]
        return left === right ? byName(a, b) : right > left ? 1 : -1
      }
    }
  })
