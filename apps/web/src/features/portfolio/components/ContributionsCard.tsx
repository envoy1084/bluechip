import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { PortfolioPerformance } from "@bluechip/domain/performance/Performance"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { StockRow } from "@bluechip/ui/bluechip/stock-row"
import { formatChange } from "@bluechip/ui/lib/format"
import { Link } from "@tanstack/react-router"
import { ListCardHeader } from "../../../components/layout/ListCardHeader.tsx"
import { usdcDollars } from "../../../lib/amounts.ts"
import { agentLineDetail, stockLineDetail } from "../model/contributions.ts"

const tone = (amount: bigint) => (amount > BigInt(0) ? "text-gain" : amount < BigInt(0) ? "text-loss" : "text-g-500")

function Profit({ amount }: Readonly<{ amount: bigint }>) {
  return (
    <b className={`text-body-sm font-semibold tabular-nums ${tone(amount)}`}>{formatChange(usdcDollars(amount))}</b>
  )
}

/** What each stock and each agent added to your results, biggest first. */
export function ContributionsCard(
  { names, performance }: Readonly<{ performance: PortfolioPerformance; names: ReadonlyMap<StockSymbol, string> }>
) {
  if (performance.stocks.length === 0 && performance.agents.length === 0) return null

  return (
    <section aria-labelledby="contributions-title" className="overflow-hidden rounded-lg bg-white shadow-e2">
      <ListCardHeader id="contributions-title" title="By stock and agent" />
      <ul className="grid">
        {performance.stocks.map((line) => (
          <li key={line.symbol} className="border-b border-g-100 last:border-b-0 [&>*]:border-b-0">
            <StockRow
              symbol={line.symbol}
              name={names.get(line.symbol) ?? line.symbol}
              detail={stockLineDetail(line)}
              trailing={<Profit amount={line.realised + line.unrealised} />}
              render={<Link to="/stocks/$symbol" params={{ symbol: line.symbol }} />}
            />
          </li>
        ))}
        {performance.agents.map((line) => (
          <li key={line.agentId} className="border-b border-g-100 last:border-b-0">
            <Link
              to="/agents/$agentId"
              params={{ agentId: line.agentId }}
              className="flex items-center gap-3 px-4 py-3 transition-colors duration-fast ease-brand hover:bg-g-50 focus-visible:shadow-[inset_0_0_0_2px_var(--color-blue)] focus-visible:outline-none"
            >
              <AgentAvatar agentId={line.agentId} size="sm" />
              <span className="grid min-w-0 flex-1 gap-px">
                <b className="truncate text-body-sm font-[550]">{line.name}</b>
                <span className="text-label-sm text-g-500 tabular-nums">{agentLineDetail(line)}</span>
              </span>
              <Profit amount={line.realised + line.unrealised} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
