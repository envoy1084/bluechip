// How the policies form lays an agent's policies out, one decision at a time: what it trades first, then its limits,
// then the rules to add and the fine-tuning most people leave alone.
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { hasPolicy, VISIBLE_POLICIES } from "@bluechip/domain/policies/SpecEdits"

// Settings most people leave as they are, folded away unless one of them blocks locking.
export const FINE_TUNING: ReadonlyArray<PolicyId> = ["fairPrice", "slippageBudget", "tradesPerDay"]

export interface PolicySections {
  /** The limits it carries now, after what it trades: every visible policy on it but the trade and fine-tuning. */
  readonly limits: ReadonlyArray<PolicyId>
  /** Optional rules it doesn't carry yet, to add. */
  readonly more: ReadonlyArray<PolicyId>
  /** The fine-tuning it carries, then the optional fine-tuning it doesn't. */
  readonly fineTuning: ReadonlyArray<PolicyId>
  readonly fineTuningToAdd: ReadonlyArray<PolicyId>
}

/** Where each visible policy goes in the form, in the order `TradeGuard` runs them. */
export const policySections = (spec: AgentSpec): PolicySections => {
  const visible = VISIBLE_POLICIES.map((policy) => policy.id as PolicyId)
  const on = visible.filter((id) => hasPolicy(spec, id))
  const off = visible.filter((id) => !hasPolicy(spec, id) && !policyOf(id).required)

  return {
    limits: on.filter((id) => id !== "trade" && !FINE_TUNING.includes(id)),
    more: off.filter((id) => !FINE_TUNING.includes(id)),
    fineTuning: on.filter((id) => FINE_TUNING.includes(id)),
    fineTuningToAdd: off.filter((id) => FINE_TUNING.includes(id))
  }
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
