import type { StockSymbol } from "@bluechip/domain/market/Market"
import { StatGrid, StatTile } from "@bluechip/ui/bluechip/stat-tile"
import { formatChange, formatDate, formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { shareCount, usdcDollars } from "../../../lib/amounts.ts"
import { costsSentence } from "../../../lib/performance.ts"
import { stockPerformanceAtom } from "../atoms/performance.ts"

/**
 * What you made and paid in this stock: your cost (FIFO) and its average a share, profit realised and unrealised, and
 * what the trades cost; nothing until you've traded it or held it.
 */
export function YourResults({ symbol }: Readonly<{ symbol: StockSymbol }>) {
  const result = useAtomValue(stockPerformanceAtom(symbol))
  if (!AsyncResult.isSuccess(result)) return null

  const performance = result.value
  if (performance.trades === 0 && performance.lots.length === 0) return null

  const shares = shareCount(performance.shares)
  const average = shares === 0 ? null : usdcDollars(performance.cost) / shares
  const oldest = performance.lots[0]
  const found = performance.lots.filter((lot) => lot.flagged).length

  return (
    <section aria-labelledby="your-results" className="grid gap-4 rounded-lg bg-white p-5 shadow-e2">
      <h2 id="your-results" className="text-[14.5px] font-semibold tracking-[-0.01em]">Your results</h2>
      <StatGrid>
        <StatTile
          label="Your cost"
          value={formatMoney(usdcDollars(performance.cost))}
          detail={average === null ? "Nothing held" : `${formatMoney(average)} a share`}
        />
        <StatTile
          label="Unrealised"
          value={formatChange(usdcDollars(performance.unrealised))}
          detail={`Worth ${formatMoney(usdcDollars(performance.value))} now`}
        />
        <StatTile
          label="Realised"
          value={formatChange(usdcDollars(performance.realised))}
          detail="From what you sold"
        />
        <StatTile
          label="Trades"
          value={performance.trades}
          detail={oldest === undefined ?
            "None held" :
            `Held since ${formatDate(DateTime.toDateUtc(oldest.openedAt))}`}
        />
      </StatGrid>
      <p className="text-label-sm text-g-600">
        {performance.trades === 0 ? "No trades yet." : `Costs: ${costsSentence(performance.costs)}.`}
        {performance.lots.length > 1 ?
          ` ${formatShareCount(shares)} in ${performance.lots.length} lots; sales take the oldest first.` :
          ""}
        {found === 0 ? "" : " Some of these shares came from outside bluechip and cost their market price then."}
      </p>
    </section>
  )
}
