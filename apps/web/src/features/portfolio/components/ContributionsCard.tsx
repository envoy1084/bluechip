import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { PortfolioPerformance } from "@bluechip/domain/performance/Performance"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { formatChange, formatMoney } from "@bluechip/ui/lib/format"
import { Link } from "@tanstack/react-router"
import { usdcDollars } from "../../../lib/amounts.ts"

const tone = (amount: bigint) => (amount > BigInt(0) ? "text-gain" : amount < BigInt(0) ? "text-loss" : "text-g-500")

/** What each stock and each agent added to your results, biggest first. */
export function ContributionsCard(
  { names, performance }: Readonly<{ performance: PortfolioPerformance; names: ReadonlyMap<StockSymbol, string> }>
) {
  if (performance.stocks.length === 0 && performance.agents.length === 0) return null

  return (
    <section aria-labelledby="contributions-title" className="overflow-hidden rounded-lg bg-white shadow-e2">
      <h2 id="contributions-title" className="border-b border-g-100 px-4 py-[11px] text-body-sm font-semibold">
        By stock and agent
      </h2>
      <ul className="grid divide-y divide-g-100">
        {performance.stocks.map((line) => {
          const profit = line.realised + line.unrealised
          return (
            <li key={line.symbol}>
              <Link
                to="/stocks/$symbol"
                params={{ symbol: line.symbol }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-g-50"
              >
                <TickerChip symbol={line.symbol} size="sm" />
                <span className="grid min-w-0 flex-1">
                  <b className="truncate text-[14px] font-semibold">{names.get(line.symbol) ?? line.symbol}</b>
                  <span className="text-label-sm text-g-500">
                    Cost {formatMoney(usdcDollars(line.cost))}, worth {formatMoney(usdcDollars(line.value))}
                  </span>
                </span>
                <b className={`text-[14px] font-semibold tabular-nums ${tone(profit)}`}>
                  {formatChange(usdcDollars(profit))}
                </b>
              </Link>
            </li>
          )
        })}
        {performance.agents.map((line) => {
          const profit = line.realised + line.unrealised
          return (
            <li key={line.agentId}>
              <Link
                to="/agents/$agentId"
                params={{ agentId: line.agentId }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-g-50"
              >
                <AgentAvatar agentId={line.agentId} size="sm" />
                <span className="grid min-w-0 flex-1">
                  <b className="truncate text-[14px] font-semibold">{line.name}</b>
                  <span className="text-label-sm text-g-500">
                    {line.trades} {line.trades === 1 ? "trade" : "trades"}, {formatChange(usdcDollars(line.realised))}
                    {" "}
                    realised
                  </span>
                </span>
                <b className={`text-[14px] font-semibold tabular-nums ${tone(profit)}`}>
                  {formatChange(usdcDollars(profit))}
                </b>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
