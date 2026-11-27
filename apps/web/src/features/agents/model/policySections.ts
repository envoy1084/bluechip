// How the policies form lays an agent's policies out, one decision at a time: what it trades first, then its limits,
// then the fine-tuning most people leave alone. Each list keeps the catalog's order whether a rule is on or off, so a
// rule never jumps when it is switched.
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { type Change, configOf } from "@bluechip/domain/policies/Policy"
import { hasPolicy, VISIBLE_POLICIES } from "@bluechip/domain/policies/SpecEdits"
import { trade } from "@bluechip/domain/policies/Trade"

// Settings most people leave as they are, folded away unless one of them blocks locking.
export const FINE_TUNING: ReadonlyArray<PolicyId> = ["fairPrice", "slippageBudget", "tradesPerDay"]

interface PolicySections {
  /** Its limits after what it trades: every visible policy but the trade and fine-tuning, carried or one to add. */
  readonly limits: ReadonlyArray<PolicyId>
  /** The fine-tuning, carried or one to add. */
  readonly fineTuning: ReadonlyArray<PolicyId>
}

/** Where each visible policy goes in the form, in the order `TradeGuard` runs them. */
export const policySections = (spec: AgentSpec): PolicySections => {
  const shown = VISIBLE_POLICIES
    .map((policy) => policy.id as PolicyId)
    .filter((id) => hasPolicy(spec, id) || !policyOf(id).required)

  return {
    limits: shown.filter((id) => id !== "trade" && !FINE_TUNING.includes(id)),
    fineTuning: shown.filter((id) => FINE_TUNING.includes(id))
  }
}

interface TradeChanges {
  /** Its stocks, under "What it trades". */
  readonly stocks: Change
  /** Its direction and daily budget, under "Its limits". */
  readonly limits: Change
}

/**
 * How the trade policy compares with the one in force, split as the form shows it: its stocks under "What it trades",
 * its direction and daily budget under "Its limits", so each mark sits beside the fields that changed.
 */
export const tradeChanges = (before: AgentSpec, after: AgentSpec): TradeChanges => {
  const old = configOf(before.policies, trade)
  const next = configOf(after.policies, trade)
  if (old === undefined || next === undefined) return { stocks: "same", limits: "same" }

  const stocksOnly = { ...old, stocks: next.stocks }
  return { stocks: trade.compare(old, stocksOnly), limits: trade.compare(stocksOnly, next) }
}

/**
 * One policy as its collapsed row reads, in the catalog's words: what it lets the agent do, or, for a policy that only
 * forbids, what it never may. One it doesn't carry reads as the catalog's summary. The review lists every "never".
 */
export const policySummary = (spec: AgentSpec, id: PolicyId, nameOf: (symbol: StockSymbol) => string): string => {
  const entry = spec.policies.find((candidate) => candidate.id === id)
  if (entry === undefined) return policyOf(id).summary

  const { can, never } = policyOf(id).describe(entry.config as never, { policies: spec.policies, name: nameOf })
  if (can.length > 0) return `${can.join(". ")}.`
  return never.length > 0
    ? `Never ${never.map((line) => line.charAt(0).toLowerCase() + line.slice(1)).join(", or ")}.`
    : policyOf(id).summary
}
