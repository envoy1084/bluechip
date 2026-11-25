import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import { AllocationDonut } from "@bluechip/ui/bluechip/allocation-donut"
import { bpsPercent } from "../../../lib/amounts.ts"

/** How your money is split between stocks and cash. Targets join when an agent keeps a mix for you. */
export function MixCard(
  { portfolio, names }: Readonly<{ portfolio: Portfolio; names: ReadonlyMap<StockSymbol, string> }>
) {
  const invested = portfolio.holdings.reduce((sum, holding) => sum + holding.weightBps, 0)
  const slices = [
    ...portfolio.holdings.map((holding) => ({
      id: holding.symbol,
      label: names.get(holding.symbol) ?? holding.symbol,
      current: bpsPercent(holding.weightBps)
    })),
    { id: "cash", label: "Cash", current: bpsPercent(10_000 - invested) }
  ]

  return (
    <section className="grid content-start gap-3 rounded-lg bg-white px-5 py-[18px] shadow-e2">
      <b className="text-[14.5px] font-semibold tracking-[-0.01em]">Your mix</b>
      <AllocationDonut slices={slices} />
    </section>
  )
}
