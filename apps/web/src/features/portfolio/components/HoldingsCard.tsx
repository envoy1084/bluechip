import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import { CashHoldingRow, HoldingRow } from "@bluechip/ui/bluechip/holding-row"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { cashDialogAtom } from "../../../atoms/cashDialog.ts"
import { ListCardHeader } from "../../../components/layout/ListCardHeader.tsx"
import { bpsPercent, shareCount, usdcDollars } from "../../../lib/amounts.ts"

type Sort = "value" | "today" | "name"

/** What you own, biggest first (or by today's move, or by name), with cash always last. */
export function HoldingsCard(
  { portfolio, names }: Readonly<{ portfolio: Portfolio; names: ReadonlyMap<StockSymbol, string> }>
) {
  const openCash = useAtomSet(cashDialogAtom)
  const [sort, setSort] = useState<Sort>("value")

  const nameOf = (symbol: StockSymbol) => names.get(symbol) ?? symbol
  const holdings = [...portfolio.holdings].sort((a, b) =>
    sort === "name" ?
      nameOf(a.symbol).localeCompare(nameOf(b.symbol)) :
      sort === "today" ?
      (b.change24h ?? 0) - (a.change24h ?? 0) :
      Number(b.value - a.value)
  )

  return (
    <section aria-labelledby="holdings-title" className="overflow-hidden rounded-lg bg-white shadow-e2">
      <ListCardHeader
        id="holdings-title"
        title="Holdings"
        actions={
          <Tabs variant="segmented" value={sort} onValueChange={(value) => setSort(value as Sort)}>
            <TabsList
              aria-label="Sort holdings"
              className="[&_[role=tab]]:h-[26px] [&_[role=tab]]:px-2.5 [&_[role=tab]]:text-label-sm"
            >
              <TabsTab value="value">Value</TabsTab>
              <TabsTab value="today">Today</TabsTab>
              <TabsTab value="name">Name</TabsTab>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid">
        {holdings.map((holding) => (
          <HoldingRow
            key={holding.symbol}
            symbol={holding.symbol}
            name={nameOf(holding.symbol)}
            shares={shareCount(holding.shares)}
            value={usdcDollars(holding.value)}
            weight={bpsPercent(holding.weightBps)}
            change={holding.change24h === null ? null : bpsPercent(holding.change24h)}
            render={<Link to="/stocks/$symbol" params={{ symbol: holding.symbol }} />}
          />
        ))}
        <CashHoldingRow
          value={usdcDollars(portfolio.cash)}
          weight={portfolio.value === BigInt(0) ? 0 : Number((portfolio.cash * BigInt(10_000)) / portfolio.value) / 100}
          onClick={() => openCash("add")}
        />
      </div>
    </section>
  )
}
