import { type Decision, evaluate, type Leg, type Proposal } from "@bluechip/domain/agents/Evaluate"
import { Limits, OVERSHOOT_BPS, PROGRESS_BPS, Target } from "@bluechip/domain/agents/Limits"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import { drift, valueHoldings } from "@bluechip/domain/agents/TradeMath"
import { Price, Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"

const between = (minimum: number, maximum: number) => Schema.Int.check(Schema.isBetween({ minimum, maximum }))

const PRICES = { NVDA: Price.make(BigInt(10_000_000_000)), AAPL: Price.make(BigInt(20_000_000_000)) }
const FEEDS = { NVDA: { price: PRICES.NVDA, ageSeconds: 60 }, AAPL: { price: PRICES.AAPL, ageSeconds: 60 } }

// One leg at Chainlink's price, less a fill shortfall in basis points: buy or sell NVDA or AAPL.
const legOf = (kind: number, dollars: number, shortfall: number): Leg => {
  const symbol = kind % 2 === 0 ? "NVDA" : "AAPL"
  const price = PRICES[symbol]
  const usdc = Usdc.make(BigInt(dollars) * BigInt(1_000_000))
  if (kind < 2) {
    const fair = sharesFor(usdc, price)
    return { symbol, side: "buy", amountIn: usdc, amountOut: (fair * BigInt(10_000 - shortfall)) / BigInt(10_000) }
  }
  const sold = sharesFor(usdc, price)
  const fair = valueOf(sold, price)
  return { symbol, side: "sell", amountIn: sold, amountOut: (fair * BigInt(10_000 - shortfall)) / BigInt(10_000) }
}

const proposalOf = (limits: Limits, cash: number, nvda: number, aapl: number, legs: ReadonlyArray<Leg>): Proposal => ({
  limits,
  holdings: {
    usdc: Usdc.make(BigInt(cash) * BigInt(1_000_000)),
    shares: { NVDA: Shares.make(BigInt(nvda) * BigInt(1_000_000)), AAPL: Shares.make(BigInt(aapl) * BigInt(1_000_000)) }
  },
  prices: FEEDS,
  usage: { spentToday: Usdc.make(BigInt(0)), tradesToday: 0, slippage: { used: Usdc.make(BigInt(0)), updatedAt: 0 } },
  legs,
  now: DateTime.makeUnsafe("2026-11-25T15:00:00Z")
})

const goesAhead = (decision: Decision) => decision._tag === "Allowed" || decision._tag === "NeedsApproval"

const rebalancer = draftLimits({
  template: "rebalancer",
  preset: "active",
  stocks: ["NVDA", "AAPL"],
  targets: [
    new Target({ asset: "NVDA", weight: 3000 }),
    new Target({ asset: "AAPL", weight: 3000 }),
    new Target({ asset: "USDC", weight: 4000 })
  ]
})

describe("properties", () => {
  it.prop(
    "a rebalance that goes ahead gets closer to the mix and never passes a target",
    {
      cash: between(0, 4000),
      nvda: between(0, 4000),
      aapl: between(0, 2000),
      kind: between(0, 3),
      dollars: between(5, 400),
      shortfall: between(0, 40)
    },
    ({ aapl, cash, dollars, kind, nvda, shortfall }) => {
      const leg = legOf(kind, dollars, shortfall)
      const proposal = proposalOf(rebalancer, cash, nvda, aapl, [leg])
      if (!goesAhead(evaluate(proposal))) return

      const before = valueHoldings(proposal.holdings, PRICES)
      const shares = { ...proposal.holdings.shares }
      const change = leg.side === "buy" ? leg.amountOut : -leg.amountIn
      shares[leg.symbol] = Shares.make((shares[leg.symbol] ?? BigInt(0)) + change)
      const cashAfter = proposal.holdings.usdc + (leg.side === "buy" ? -leg.amountIn : leg.amountOut)
      const after = valueHoldings({ usdc: Usdc.make(cashAfter), shares }, PRICES)

      if (drift(after, rebalancer.targets) > drift(before, rebalancer.targets) - PROGRESS_BPS) return false
      const value = after.values.get(leg.symbol) ?? BigInt(0)
      const limit = BigInt(3000 + (leg.side === "buy" ? OVERSHOOT_BPS : -OVERSHOOT_BPS)) * after.total
      return leg.side === "buy" ? value * BigInt(10_000) <= limit : value * BigInt(10_000) >= limit
    },
    // About one random trade in six goes ahead, so run enough to check a few hundred.
    { arbitrary: { runs: 2000 } }
  )

  const picker = draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

  // Each number limit made tighter by `step` (out of 4).
  const tighten = (field: number, step: number): Limits => {
    const factor = BigInt(4 - step)
    switch (field) {
      case 0:
        return new Limits({ ...picker, dailyBudget: Usdc.make((picker.dailyBudget * factor) / BigInt(4)) })
      case 1:
        return new Limits({ ...picker, maxPerTrade: Usdc.make((picker.maxPerTrade * factor) / BigInt(4)) })
      case 2:
        return new Limits({ ...picker, maxInOneStock: picker.maxInOneStock - step * 500 })
      case 3:
        return new Limits({ ...picker, cashReserve: picker.cashReserve + step * 500 })
      case 4:
        return new Limits({ ...picker, tradesPerDay: Math.max(1, picker.tradesPerDay - step * 3) })
      case 5:
        return new Limits({ ...picker, priceProtection: 50 })
      default:
        return new Limits({ ...picker, weeklySlippage: 50 })
    }
  }

  it.prop(
    "tighter limits never let through a trade the looser ones stop",
    {
      cash: between(0, 3000),
      nvda: between(0, 3000),
      aapl: between(0, 1500),
      kind: between(0, 3),
      dollars: between(5, 150),
      shortfall: between(0, 150),
      field: between(0, 6),
      step: between(1, 3)
    },
    ({ aapl, cash, dollars, field, kind, nvda, shortfall, step }) => {
      const legs = [legOf(kind, dollars, shortfall)]
      const tighter = evaluate(proposalOf(tighten(field, step), cash, nvda, aapl, legs))
      return !goesAhead(tighter) || goesAhead(evaluate(proposalOf(picker, cash, nvda, aapl, legs)))
    },
    { arbitrary: { runs: 1000 } }
  )
})
