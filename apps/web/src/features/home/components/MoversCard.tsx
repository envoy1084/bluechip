import type { StockSymbol } from "@bluechip/domain/market/Market"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { StockRow } from "@bluechip/ui/bluechip/stock-row"
import { ButtonLink } from "@bluechip/ui/components/button"
import { formatMoney } from "@bluechip/ui/lib/format"
import { Link } from "@tanstack/react-router"
import { PageSection } from "../../../components/layout/PageSection.tsx"
import type { Mover } from "../model/holdings.ts"

/**
 * The holdings that moved most today, each with what you hold and its move, leading to the stock. Nothing without a
 * price today.
 */
export function MoversCard(
  { movers, nameOf }: Readonly<{
    movers: ReadonlyArray<Mover>
    nameOf: (symbol: StockSymbol) => string
  }>
) {
  if (movers.length === 0) return null

  return (
    <PageSection
      title="Moving today"
      actions={<ButtonLink variant="ghost" size="sm" render={<Link to="/portfolio" />}>All holdings</ButtonLink>}
    >
      <ul className="overflow-hidden rounded-lg bg-white shadow-e2">
        {movers.map((mover) => (
          <li key={mover.symbol} className="border-b border-g-100 last:border-b-0 [&>*]:border-b-0">
            <StockRow
              symbol={mover.symbol}
              name={nameOf(mover.symbol)}
              detail={`${formatMoney(mover.value)} held`}
              trailing={<PriceChange value={mover.percent} amount={mover.dollars} className="text-label-sm" />}
              render={<Link to="/stocks/$symbol" params={{ symbol: mover.symbol }} />}
            />
          </li>
        ))}
      </ul>
    </PageSection>
  )
}
