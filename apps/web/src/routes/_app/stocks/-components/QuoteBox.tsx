import type { Stock } from "@bluechip/domain/market/Market"
import { Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney, formatShares } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { portfolioAtom } from "../../../../atoms/portfolio.ts"
import { parseShares, parseUsdc, shareCount, usdcDollars } from "../../../../market/amounts.ts"
import { useMarketStatus } from "../../../../market/marketState.ts"
import { referenceGap } from "../../../../market/ReferenceGap.tsx"
import { type QuoteSide, type QuoteState, useQuote } from "../../../../market/useQuote.ts"
import { useTrade } from "../../../../market/useTrade.ts"
import { AmountInput, type AmountUnit } from "./AmountInput.tsx"
import { QuoteSummary, QuoteSummarySkeleton } from "./QuoteSummary.tsx"
import { TradeProgress } from "./TradeProgress.tsx"

/** What the quote gets back, in a sentence under the field: shares for a buy, USDC for a sell. */
const quoteHint = (quote: QuoteState) => {
  if (quote.status === "loading") return "Getting a price…"
  if (quote.status !== "ready") return null

  const { side, shares, usdc } = quote.quote
  return side === "buy" ?
    `About ${formatShares(shareCount(shares))} shares for ${formatMoney(usdcDollars(usdc))}.` :
    `About ${formatMoney(usdcDollars(usdc))} for ${formatShares(shareCount(shares))} shares.`
}

/** What to look at twice before signing: paused prices, or the stock market and Chainlink far apart. */
function TradeWarnings({ stock }: Readonly<{ stock: Stock }>) {
  const status = useMarketStatus()
  const gap = referenceGap(stock)
  const paused = status?.session === "paused"
  const apart = gap !== null && Math.abs(gap) > 1

  if (!paused && !apart) return null
  return (
    <Alert variant="warning">
      <AlertTitle>{paused ? "Prices are paused" : "Prices disagree"}</AlertTitle>
      <AlertDescription>
        {paused ?
          "It's the weekend or a holiday: Chainlink shows the last price before the pause, and the pool may have moved since. Trades must stay within 0.5% of it." :
          `The stock market and Chainlink are ${
            Math.abs(gap!).toFixed(1)
          }% apart. The trade is checked against Chainlink's price.`}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Buy with cash or sell shares of one stock, typed in dollars or shares (the unit pill switches): amount, quote, the
 * price check, then Face ID and where it stands. Buys always spend an exact USDC amount and sells sell exact shares;
 * the other unit converts at the current price.
 */
export function QuoteBox({ stock }: Readonly<{ stock: Stock }>) {
  const portfolio = useAtomValue(portfolioAtom)
  const [side, setSide] = useState<QuoteSide>("buy")
  const [unit, setUnit] = useState<AmountUnit>("usd")
  const [text, setText] = useState("")
  const { flow, reset, start } = useTrade(stock.symbol)

  const cash = AsyncResult.isSuccess(portfolio) ? portfolio.value.cash : BigInt(0)
  const held = AsyncResult.isSuccess(portfolio) ?
    portfolio.value.holdings.find((holding) => holding.symbol === stock.symbol)?.shares ?? BigInt(0) :
    BigInt(0)
  const price = stock.price?.price ?? stock.reference?.price ?? null

  // What the trade moves in its own unit: USDC spent for a buy, shares sold for a sell.
  const typed = unit === "usd" ? parseUsdc(text) : parseShares(text)
  const amount = typed === null || price === null ?
    null :
    side === "buy" ?
    (unit === "usd" ? typed : valueOf(Shares.make(typed), price)) :
    (unit === "shares" ? typed : sharesFor(Usdc.make(typed), price))
  const over = amount !== null && amount > (side === "buy" ? cash : held)

  const quote = useQuote(stock.symbol, side, stock.tradable && !over ? amount as Usdc | Shares | null : null)
  const busy = flow.status === "preparing" || flow.status === "signing"
  const ready = quote.status === "ready" && amount !== null && !over

  const available = side === "buy" ?
    `${formatMoney(usdcDollars(cash))} cash available` :
    `${formatShares(shareCount(held))} shares${
      price === null ? "" : `, worth ${formatMoney(usdcDollars(valueOf(Shares.make(held), price)))}`
    }`
  const hint = over ?
    side === "buy" ? "That's more than your cash." : "That's more than you have." :
    quoteHint(quote) ??
      (side === "buy"
        ? "Enter an amount. The smallest trade is $1."
        : held === BigInt(0)
        ? `You don't own any ${stock.symbol} yet.`
        : "Enter how much to sell.")

  // Max: all the cash for a buy, every share for a sell, in the unit shown.
  const max = () => {
    if (price === null) return
    const all = side === "buy" ? cash : held
    if (side === "buy") {
      setText(unit === "usd" ? String(usdcDollars(all)) : String(shareCount(sharesFor(Usdc.make(all), price))))
    } else setText(unit === "shares" ? String(shareCount(all)) : String(usdcDollars(valueOf(Shares.make(all), price))))
  }

  const switchUnit = (next: AmountUnit) => {
    // Keep the same amount, said in the other unit.
    if (typed !== null && price !== null) {
      setText(
        next === "shares"
          ? String(shareCount(sharesFor(Usdc.make(typed), price)))
          : usdcDollars(valueOf(Shares.make(typed), price)).toFixed(2)
      )
    }
    setUnit(next)
  }

  const trade = () => {
    if (amount === null) return
    void start(side, side === "buy" ? { usdc: Usdc.make(amount) } : { shares: Shares.make(amount) })
  }

  if (flow.status === "sent") {
    return (
      <section
        className="grid content-start gap-3.5 rounded-lg bg-white px-5 py-[18px] shadow-e2"
        aria-label="Trade status"
      >
        <b className="text-[14.5px] font-semibold">
          {flow.trade.side === "buy" ? "Buying" : "Selling"} {stock.name}
        </b>
        <TradeProgress
          trade={flow.trade}
          name={stock.name}
          onDone={() => {
            reset()
            setText("")
          }}
        />
      </section>
    )
  }

  return (
    <section
      className="grid content-start gap-3.5 rounded-lg bg-white px-5 py-[18px] shadow-e2"
      aria-label={`Trade ${stock.name}`}
    >
      <Tabs
        variant="segmented"
        value={side}
        onValueChange={(value) => {
          setSide(value as QuoteSide)
          setText("")
          reset()
        }}
        className="justify-self-start"
      >
        <TabsList
          aria-label="Buy or sell"
          className="[&_[role=tab]]:h-[26px] [&_[role=tab]]:px-2.5 [&_[role=tab]]:text-label-sm"
        >
          <TabsTab value="buy">Buy</TabsTab>
          <TabsTab value="sell">Sell</TabsTab>
        </TabsList>
      </Tabs>

      {!stock.tradable ?
        (
          <Alert variant="info">
            <AlertDescription>{stock.name} can't be traded right now.</AlertDescription>
          </Alert>
        ) :
        (
          <AmountInput
            label={side === "buy" ? `Buy ${stock.name}` : `Sell ${stock.name}`}
            available={available}
            unit={unit}
            symbol={stock.symbol}
            text={text}
            hint={hint}
            invalid={over}
            quickAmounts={side === "buy" ? [50, 100, 150] : []}
            onMax={(side === "buy" ? cash : held) === BigInt(0) ? undefined : max}
            onTextChange={setText}
            onUnitChange={switchUnit}
          />
        )}

      {quote.status === "loading" && <QuoteSummarySkeleton />}
      {quote.status === "ready" && <QuoteSummary stock={stock} quote={quote.quote} />}
      {quote.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>{quote.message}</AlertDescription>
        </Alert>
      )}

      <TradeWarnings stock={stock} />

      {flow.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>{flow.message}</AlertDescription>
        </Alert>
      )}

      <Button size="lg" disabled={!stock.tradable || !ready || busy} loading={busy} onClick={trade}>
        <Icon name="face-id" size={18} />
        {flow.status === "signing" ? "Waiting for Face ID" : `${side === "buy" ? "Buy" : "Sell"} with Face ID`}
      </Button>
    </section>
  )
}
