import { Price } from "@bluechip/domain/market/Units"
import { AgentSpec, type PolicyEntry, type PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import { draftSpec } from "@bluechip/domain/policies/Templates"

// $250 a day, $100 a trade, 30% in one stock, 10% cash, 1% slippage a week, 12 trades a day, trades while paused.
export const PICKER = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

// The same amounts, with a target mix of 30% NVDA, 30% AAPL and 40% cash and a 5% trigger.
export const REBALANCER = draftSpec({
  template: "rebalancer",
  preset: "balanced",
  stocks: ["NVDA", "AAPL"],
  targets: [{ asset: "NVDA", weight: 3000 }, { asset: "AAPL", weight: 3000 }, { asset: "USDC", weight: 4000 }]
})

// A balanced Stop-loss guard of NVDA and AAPL, selling NVDA only at or under $150 and AAPL at or under $180.
export const GUARD = complete(
  new AgentSpec({
    policies: [
      ...draftSpec({ template: "stopLossGuard", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] }).policies,
      {
        id: "stopLossFloor",
        config: {
          floors: [{ symbol: "NVDA", price: Price.make(15_000_000_000n) }, {
            symbol: "AAPL",
            price: Price.make(18_000_000_000n)
          }]
        }
      }
    ]
  })
)

// `spec` with each entry's configuration merged with a change, or added; unlike `SpecEdits.withConfig`, a change
// names only the fields it sets, and can make a spec `checkSpec` refuses.
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

// `spec` without the entries, and nothing else; unlike `SpecEdits.removePolicy`, a Rebalancer keeps its direction.
export const without = (spec: AgentSpec, ...ids: ReadonlyArray<PolicyId>): AgentSpec =>
  new AgentSpec({ policies: spec.policies.filter((entry) => !ids.includes(entry.id)) })
