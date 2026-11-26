import type { Quote, StockSymbol } from "@bluechip/domain/market/Market"
import type { PortfolioPerformance } from "@bluechip/domain/performance/Performance"
import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import {
  ChatResult,
  ChatResultHeadline,
  type ChatResultProps,
  ChatResultRow,
  ChatResultRows,
  ChatResultStat,
  ChatResultStats
} from "@bluechip/ui/bluechip/chat-result"
import { MixBar } from "@bluechip/ui/bluechip/mix-bar"
import { allocationSegments } from "@bluechip/ui/bluechip/portfolio-summary"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { formatChange, formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { QuoteSummary } from "../../../../components/trading/QuoteSummary.tsx"
import { bpsPercent, shareCount, usdcDollars } from "../../../../lib/amounts.ts"
import { dayChangePercent } from "../../model/dailyBrief.ts"
import type { ResultState } from "../../model/resultCards.ts"
import { RESULT_LOOK, type ResultLook } from "../../model/resultText.ts"
import { OpenLink } from "./OpenLink.tsx"

const money = (units: bigint) => formatMoney(usdcDollars(units))

/** A result card with its tool's look: title and icon, and what it says empty. */
export function LookedResult(
  { look, state, ...props }: Readonly<
    { look: ResultLook; state: ResultState } & Omit<ChatResultProps, "title" | "icon" | "state">
  >
) {
  return (
    <ChatResult
      title={look.title}
      icon={look.icon}
      state={state}
      {...(state === "empty" && props.message === undefined ? { message: look.empty } : {})}
      {...props}
    />
  )
}

/** Your portfolio: what it's worth and how it moved today, its mix as one strip, and the biggest holdings. */
export function PortfolioResult(
  { portfolio, state, nameOf }: Readonly<
    { portfolio: Portfolio; state: ResultState; nameOf: (symbol: StockSymbol) => string }
  >
) {
  const positions = portfolio.holdings.map((holding) => ({
    symbol: holding.symbol,
    name: nameOf(holding.symbol),
    value: usdcDollars(holding.value)
  }))
  const mix = allocationSegments(positions, usdcDollars(portfolio.cash), 4)

  return (
    <LookedResult
      look={RESULT_LOOK.getPortfolio}
      state={state}
      action={<OpenLink to="/portfolio" />}
    >
      <ChatResultHeadline
        value={money(portfolio.value)}
        change={
          <PriceChange
            size="sm"
            value={dayChangePercent(portfolio.value, portfolio.change24h)}
            amount={usdcDollars(portfolio.change24h)}
          />
        }
        detail={`${money(portfolio.cash)} in cash, ${money(portfolio.invested)} in stocks`}
      />
      {mix.length === 0 ?
        null :
        <MixBar parts={mix.map(({ id, label, percent }) => ({ id, label, percent }))} label="Your mix" />}
      {portfolio.holdings.length === 0 ?
        null :
        (
          <ChatResultRows aria-label="Biggest holdings">
            {portfolio.holdings.slice(0, 3).map((holding) => (
              <ChatResultRow
                key={holding.symbol}
                media={<TickerChip symbol={holding.symbol} size="sm" />}
                title={nameOf(holding.symbol)}
                detail={`${formatShareCount(shareCount(holding.shares))} shares, ${
                  Math.round(bpsPercent(holding.weightBps))
                }% of your money`}
                value={money(holding.value)}
                valueDetail={holding.change24h === null ?
                  undefined :
                  <PriceChange size="sm" value={bpsPercent(holding.change24h)} />}
              />
            ))}
          </ChatResultRows>
        )}
    </LookedResult>
  )
}

/** How you're doing, from the ledger: profit or loss with its shape, realised and unrealised, and the costs. */
export function PerformanceResult(
  { performance, state }: Readonly<{ performance: PortfolioPerformance; state: ResultState }>
) {
  const total = performance.realised + performance.unrealised
  const losing = total < BigInt(0)
  const series = performance.series.map((point) => usdcDollars(point.total))

  return (
    <LookedResult look={RESULT_LOOK.getPerformance} state={state} action={<OpenLink to="/portfolio" />}>
      <ChatResultHeadline
        value={<span className={losing ? "text-loss" : "text-gain"}>{formatChange(usdcDollars(total))}</span>}
        detail={`In all, over ${performance.trades} ${performance.trades === 1 ? "trade" : "trades"}. Stocks cost ${
          money(performance.cost)
        }, worth ${money(performance.value)} now.`}
        aside={series.length < 2 ?
          undefined :
          <Sparkline values={series} width={88} height={28} tone={losing ? "down" : "up"} area />}
      />
      <ChatResultStats>
        <ChatResultStat
          label="Realised"
          value={formatChange(usdcDollars(performance.realised))}
          tone={performance.realised < BigInt(0) ? "loss" : "plain"}
        />
        <ChatResultStat
          label="Unrealised"
          value={formatChange(usdcDollars(performance.unrealised))}
          tone={performance.unrealised < BigInt(0) ? "loss" : "plain"}
        />
        <ChatResultStat
          label="Fees and slippage"
          value={money(performance.costs.fees + performance.costs.slippage)}
        />
      </ChatResultStats>
    </LookedResult>
  )
}

/** A quote: what you'd pay and get, at what price, and the fair price check. A quote trades nothing. */
export function QuoteResult(
  { quote, nameOf }: Readonly<{ quote: Quote; nameOf: (symbol: StockSymbol) => string }>
) {
  return (
    <LookedResult
      look={RESULT_LOOK.getQuote}
      state="ready"
      action={<OpenLink label="Trade" to="/stocks/$symbol" params={{ symbol: quote.symbol }} />}
    >
      <QuoteSummary stock={{ symbol: quote.symbol, name: nameOf(quote.symbol) }} quote={quote} />
    </LookedResult>
  )
}
