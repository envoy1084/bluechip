import { AgentSpec, type PolicyEntry, type PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { draftSpec } from "@bluechip/domain/policies/Templates"

// A balanced Stock picker for NVDA and AAPL: $100 a trade, $250 a day, 30% in one stock, 10% cash, 1% collar.
export const PICKER = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

// `spec` with each entry's configuration merged with a change, or added; unlike `SpecEdits.withConfig`, a change
// names only the fields it sets.
export const changed = (spec: AgentSpec, ...changes: ReadonlyArray<{ id: PolicyId; config: object }>): AgentSpec =>
  new AgentSpec({
    policies: [
      ...spec.policies.map((entry) => {
        const change = changes.find((candidate) => candidate.id === entry.id)
        return (change === undefined
          ? entry
          : { id: entry.id, config: { ...entry.config, ...change.config } }) as PolicyEntry
      }),
      ...changes.filter((change) => !spec.policies.some((entry) => entry.id === change.id)) as Array<PolicyEntry>
    ]
  })

// `spec` without the entries, and nothing else.
export const without = (spec: AgentSpec, ...ids: ReadonlyArray<PolicyId>): AgentSpec =>
  new AgentSpec({ policies: spec.policies.filter((entry) => !ids.includes(entry.id)) })
