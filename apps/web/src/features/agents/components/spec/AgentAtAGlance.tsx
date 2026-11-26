import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { isNoTradeLimit, tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import { StatGrid, StatTile } from "@bluechip/ui/bluechip/stat-tile"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney } from "@bluechip/ui/lib/format"
import type { ReactNode } from "react"
import { usdcDollars } from "../../../../lib/amounts.ts"
import { DIRECTION_WORDS } from "../../model/fieldText.ts"

// Budgets are whole dollars: "$250", not "$250.00".
const dollars = (units: bigint) => formatMoney(usdcDollars(units)).replace(/\.00$/u, "")

// Shown as the stats and stock pills above, or true of every agent and said once in the footer.
const SHOWN_ABOVE: ReadonlyArray<PolicyId> = ["trade", "tradeSize", "tradesPerDay"]
const EVERY_AGENT = ["Send money out of your account", "Trade stocks you didn't pick", "Change its own policies"]

/**
 * An agent's rules at a glance while you set them: its stocks as pills, which way it trades, its three numbers, what
 * its other rules let it do, and only the limits that are its own; what every agent can never do is one line.
 */
export function AgentAtAGlance(
  { spec, nameOf, lockedLine = "Not locked yet", action }: Readonly<{
    spec: AgentSpec
    nameOf: (symbol: StockSymbol) => string
    lockedLine?: string
    /** Beside the lock line, like "Edit rules" on the review. */
    action?: ReactNode
  }>
) {
  const trading = configOf(spec.policies, trade)
  const size = configOf(spec.policies, tradeSize)
  const perDay = configOf(spec.policies, tradesPerDay)
  const described = spec.policies
    .filter((entry) => !SHOWN_ABOVE.includes(entry.id))
    .map((entry) => policyOf(entry.id).describe(entry.config as never, { policies: spec.policies, name: nameOf }))
  const can = described.flatMap((description) => description.can)
  const never = described.flatMap((description) => description.never).filter((line) => !EVERY_AGENT.includes(line))
  const stocks = trading?.stocks ?? []

  return (
    <section aria-label="Its rules at a glance" className="overflow-hidden rounded-lg bg-white shadow-e2">
      <div className="grid gap-3 px-[18px] pt-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-semibold tracking-[-0.015em]">At a glance</h3>
          {trading === undefined ?
            null :
            (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-label-sm font-medium text-blue">
                {DIRECTION_WORDS[trading.direction]}
              </span>
            )}
        </div>
        {stocks.length === 0 ?
          <p className="text-label text-g-500">No stocks yet. Pick the ones it may trade.</p> :
          (
            <ul aria-label="Its stocks" className="flex flex-wrap gap-1.5">
              {stocks.map((symbol) => (
                <li key={symbol} title={nameOf(symbol)}>
                  <TickerChip symbol={symbol} size="sm" />
                </li>
              ))}
            </ul>
          )}
      </div>

      <StatGrid className="grid-cols-3 border-y border-g-100 bg-g-50/60 px-[18px] py-3.5 sm:grid-cols-3">
        <StatTile
          label="A day"
          value={trading === undefined || trading.dailyBudget === BigInt(0) ? "No buys" : dollars(trading.dailyBudget)}
        />
        <StatTile
          label="Per trade"
          value={size === undefined ? "Any" : dollars(size.maxPerTrade)}
        />
        <StatTile
          label="Trades a day"
          value={perDay === undefined || isNoTradeLimit(perDay) ? "No limit" : perDay.count}
        />
      </StatGrid>

      {can.length === 0 && never.length === 0 ? null : (
        <div className="grid gap-2 px-[18px] py-4">
          {can.length === 0 ? null : (
            <ul aria-label="It can" className="grid gap-2">
              {can.map((line) => (
                <li key={line} className="grid grid-cols-[18px_1fr] gap-1.5 text-[13.5px] leading-[1.45] text-g-800">
                  <Icon name="check" size={14} className="mt-0.5 text-gain" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
          {/* What it can never do protects you: a quiet shield, not a red cross that reads as a failure. */}
          {never.length === 0 ? null : (
            <ul aria-label="It can never" className="grid gap-2">
              {never.map((line) => (
                <li key={line} className="grid grid-cols-[18px_1fr] gap-1.5 text-[13.5px] leading-[1.45] text-g-800">
                  <Icon name="shield" size={14} className="mt-0.5 text-g-400" />
                  <span>Never {line.charAt(0).toLowerCase() + line.slice(1)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-g-100 px-[18px] py-3">
        <span className="inline-flex items-center gap-1.5 text-label-sm text-g-500">
          <Icon name="lock" size={13} />
          {lockedLine}
        </span>
        {action}
      </div>
    </section>
  )
}
