import { baseDeployment } from "@bluechip/chain/deployments/Base"
import { Address } from "@bluechip/domain/Ids"
import { MarketPrice, Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { formatDollars, listNames } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { templateSpec } from "@bluechip/domain/policies/SpecEdits"
import type { TemplateId } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { WorstCaseCard } from "@bluechip/ui/bluechip/worst-case-card"
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"
import { type ComponentType, useState } from "react"

/** An agent's rules at a glance, as the new-agent flow shows them; it comes from the agents feature, through the route. */
export type GlanceView = ComponentType<{ spec: AgentSpec; nameOf: (symbol: StockSymbol) => string }>

/** The new-agent flow's form for an agent's rules; it comes from the agents feature, through the route. */
export type SpecEditorView = ComponentType<{
  spec: AgentSpec
  onChange: (spec: AgentSpec) => void
  stocks: ReadonlyArray<Stock>
  nameOf: (symbol: StockSymbol) => string
  template: TemplateId | null
}>

// What the agent starts with; every stock bluechip trades is there to pick.
const STARTING: ReadonlyArray<StockSymbol> = ["AAPL", "NVDA", "TSLA"]
const TEMPLATE: TemplateId = "stockPicker"

// Example prices in dollars, for the stop-loss floors' "now" and their quick drops; a landing page has no market data.
const EXAMPLE_PRICES: Readonly<Record<StockSymbol, number>> = {
  AAPL: 241.18,
  AMZN: 214.36,
  ANT: 120,
  CRCL: 82.1,
  GOOGL: 178.9,
  INTC: 24.3,
  META: 612.3,
  MSFT: 455.6,
  MSTR: 318.2,
  NVDA: 181.42,
  SNDK: 64.85,
  SPCX: 98.4,
  TSLA: 352.75
}
const PRICED_AT = DateTime.makeUnsafe(new Date("2026-11-27T21:00:00Z"))

const isStockSymbol = Schema.is(StockSymbol)

// Every stock bluechip trades on Base, from its deployment record.
const STOCKS = baseDeployment.stocks.flatMap((stock) => {
  if (!isStockSymbol(stock.symbol)) return []
  const price = Price.make(BigInt(Math.round(EXAMPLE_PRICES[stock.symbol] * 100)) * BigInt(1_000_000))
  return [
    new Stock({
      symbol: stock.symbol,
      name: stock.name,
      token: Address.make(stock.token),
      tradable: stock.pool !== null,
      logoUrl: stock.logoUrl,
      price: new MarketPrice({ symbol: stock.symbol, price, tradedAt: PRICED_AT, previousClose: price }),
      reference: null,
      change24h: null
    })
  ]
})

const nameOf = (symbol: StockSymbol): string => STOCKS.find((stock) => stock.symbol === symbol)?.name ?? symbol

/**
 * A Stock picker set up with the new-agent flow's own form, over every stock bluechip trades: presets, sliders and
 * switches on the left, its rules at a glance and its worst day on the right, both following every change.
 */
export function LimitsDemo({ Editor, Glance }: Readonly<{ Editor: SpecEditorView; Glance: GlanceView }>) {
  const [spec, setSpec] = useState(() => templateSpec(TEMPLATE, "balanced", STARTING))
  const budget = configOf(spec.policies, trade)?.dailyBudget ?? BigInt(0)
  const perTrade = configOf(spec.policies, tradeSize)?.maxPerTrade ?? BigInt(0)
  const stocks = configOf(spec.policies, trade)?.stocks ?? []

  return (
    <div className="grid items-start gap-4 rounded-[28px] bg-[linear-gradient(180deg,var(--color-g-50),#fff)] p-3 text-left shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)] sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Editor spec={spec} onChange={setSpec} stocks={STOCKS} nameOf={nameOf} template={TEMPLATE} />

      <div className="grid min-w-0 gap-4 lg:sticky lg:top-24">
        <Glance spec={spec} nameOf={nameOf} />
        <WorstCaseCard>
          {budget > BigInt(0) ?
            (
              <>
                On its worst day it could spend at most <b>{formatDollars(budget)}</b>, up to{" "}
                <b>{formatDollars(perTrade)}</b> a trade
                {stocks.length === 0 ? "" : `, only in ${listNames(stocks.map(nameOf))}`}.
              </>
            ) :
            (
              <>
                It never buys. It can sell up to <b>{formatDollars(perTrade)}</b> a trade.
              </>
            )} It can never move money out of your account.
        </WorstCaseCard>
      </div>
    </div>
  )
}
