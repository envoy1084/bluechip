// Agent specs the tests lock, change and save.
import { AgentSpec, type PolicyEntry, type PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { draftSpec } from "@bluechip/domain/policies/Templates"

/** A balanced Stock picker for NVDA and AAPL: $100 a trade, $250 a day, 30% in one stock, 10% cash. */
export const PICKER = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

/** `spec` with each entry's configuration changed. */
export const changed = (spec: AgentSpec, ...changes: ReadonlyArray<{ id: PolicyId; config: object }>) =>
  new AgentSpec({
    policies: spec.policies.map((entry) => {
      const change = changes.find((candidate) => candidate.id === entry.id)
      return (change === undefined
        ? entry
        : { id: entry.id, config: { ...entry.config, ...change.config } }) as PolicyEntry
    })
  })
