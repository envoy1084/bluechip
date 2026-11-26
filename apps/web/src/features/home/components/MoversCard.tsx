import type { StockSymbol } from "@bluechip/domain/market/Market"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { ButtonLink } from "@bluechip/ui/components/button"
import { formatMoney } from "@bluechip/ui/lib/format"
import { Link } from "@tanstack/react-router"
import { PageSection } from "../../../components/layout/PageSection.tsx"
import type { Mover } from "../model/holdings.ts"

/**
 * The holdings that moved most today, each with what you hold and its move, leading to the stock. `held` is how many
 * stocks you hold: with three or fewer it's simply your stocks today. Nothing without a price today.
 */
export function MoversCard(
  { movers, held, nameOf }: Readonly<{
    movers: ReadonlyArray<Mover>
    held: number
    nameOf: (symbol: StockSymbol) => string
  }>
) {
  if (movers.length === 0) return null

  return (
    <PageSection
      title={held > movers.length ? "Today's movers" : "Your stocks today"}
      actions={<ButtonLink variant="ghost" size="sm" render={<Link to="/portfolio" />}>All holdings</ButtonLink>}
    >
      <ul className="overflow-hidden rounded-lg bg-white shadow-e2">
        {movers.map((mover) => (
          <li key={mover.symbol} className="border-b border-g-100 last:border-b-0">
            <Link
              to="/stocks/$symbol"
              params={{ symbol: mover.symbol }}
              className="flex items-center gap-3 px-4 py-3 transition-colors duration-fast ease-brand hover:bg-g-50 focus-visible:bg-g-50 focus-visible:outline-none"
            >
              <TickerChip symbol={mover.symbol} size="sm" />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <b className="truncate text-body-sm font-semibold">{nameOf(mover.symbol)}</b>
                <span className="text-label-sm text-g-500 tabular-nums">{formatMoney(mover.value)} held</span>
              </span>
              <PriceChange value={mover.percent} amount={mover.dollars} className="shrink-0 text-label-sm" />
            </Link>
          </li>
        ))}
      </ul>
    </PageSection>
  )
}
