import type { Stock } from "@bluechip/domain/market/Market"
import { Shares } from "@bluechip/domain/market/Units"
import { MoneyInput } from "@bluechip/ui/bluechip/money-input"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney, formatShares, formatTokenAmount } from "@bluechip/ui/lib/format"
import { UsdcLogo } from "@bluechip/ui/logos/usdc"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { portfolioAtom } from "../../../../atoms/portfolio.ts"
import { parseShares, parseUsdc, shareCount, usdcDollars } from "../../../../market/amounts.ts"
import { useMarketStatus } from "../../../../market/marketState.ts"
import { referenceGap } from "../../../../market/ReferenceGap.tsx"
import { type QuoteSide, type QuoteState, useQuote } from "../../../../market/useQuote.ts"
import { useTrade } from "../../../../market/useTrade.ts"
import { QuoteSummary, QuoteSummarySkeleton } from "./QuoteSummary.tsx"
import { TradeProgress } from "./TradeProgress.tsx"

const sharesText = (text: string) => {
  const [whole = "", ...rest] = text.replace(/[^\d.]/g, "").split(".")
  return rest.length === 0 ? whole : `${whole}.${rest.join("").slice(0, 8)}`
}

/** What the typed amount gets, in a sentence under the field, once there is a quote for it. */
const quoteHint = (quote: QuoteState) => {
  if (quote.status === "loading") return "Getting a price…"
  if (quote.status !== "ready") return null

  const { side, shares, usdc } = quote.quote
  return side === "buy" ?
    `About ${shareCount(shares).toFixed(3)} shares.` :
    `About ${formatTokenAmount(usdc, "USDC", { decimals: 6 })}.`
}

function SharesInput(
  { symbol, held, hint, text, onChange }: Readonly<{
    symbol: string
    held: bigint
    hint: string | null
    text: string
    onChange: (text: string) => void
  }>
) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="sell-shares" className="text-[13.5px] font-semibold">Sell {symbol}</label>
        <span className="text-caption text-g-500">{formatShares(shareCount(held))} shares available</span>
      </div>
      <InputGroup className="h-auto rounded-[10px] bg-g-50 py-1.5 pr-1.5 pl-2.5 focus-within:bg-white">
        <InputGroupInput
          id="sell-shares"
          value={text}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-describedby="sell-shares-hint"
          onChange={(event) => onChange(sharesText(event.currentTarget.value))}
          className="text-[18px] font-semibold tracking-[-0.02em] tabular-nums placeholder:text-g-300"
        />
        <InputGroupText className="font-semibold text-g-500">shares</InputGroupText>
        <Button
          variant="secondary"
          size="sm"
          disabled={held === BigInt(0)}
          onClick={() => onChange(String(shareCount(held)))}
        >
          Sell all
        </Button>
      </InputGroup>
      <p id="sell-shares-hint" aria-live="polite" className="min-h-[1.4em] text-caption text-g-500">
        {hint ?? (held === BigInt(0) ? `You don't own any ${symbol} yet.` : "Enter how many shares to sell.")}
      </p>
    </div>
  )
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

/** Buy with cash or sell shares of one stock: amount, quote, the price check, then Face ID and where it stands. */
export function QuoteBox({ stock }: Readonly<{ stock: Stock }>) {
  const portfolio = useAtomValue(portfolioAtom)
  const [side, setSide] = useState<QuoteSide>("buy")
  const [amountText, setAmountText] = useState("")
  const quote = useQuote(stock.symbol, side, stock.tradable ? amountText : "")
  const { flow, reset, start } = useTrade(stock.symbol)

  const cash = AsyncResult.isSuccess(portfolio) ? portfolio.value.cash : BigInt(0)
  const held = AsyncResult.isSuccess(portfolio) ?
    portfolio.value.holdings.find((holding) => holding.symbol === stock.symbol)?.shares ?? BigInt(0) :
    BigInt(0)
  const usdc = side === "buy" ? parseUsdc(amountText) : null
  const shares = side === "sell" ? parseShares(amountText) : null
  const busy = flow.status === "preparing" || flow.status === "signing"
  const ready = quote.status === "ready" && (usdc !== null ? usdc <= cash : shares !== null && shares <= held)

  const trade = () => {
    if (usdc !== null) void start("buy", { usdc })
    else if (shares !== null) void start("sell", { shares: Shares.make(shares) })
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
            setAmountText("")
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
          setAmountText("")
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
        side === "buy" ?
        (
          <MoneyInput
            key="buy"
            label={`Buy ${stock.name} with`}
            description={
              <span className="inline-flex items-center gap-1.5">
                <UsdcLogo size={13} />
                Cash (USDC) · {formatMoney(usdcDollars(cash))} available
              </span>
            }
            currency="usdc"
            size="md"
            available={usdcDollars(cash)}
            showMax={false}
            quickAmounts={[50, 100, 150]}
            hint={quoteHint(quote)}
            emptyHint="Enter an amount. The smallest trade is $1."
            onValueChange={(amount) => setAmountText(amount === null ? "" : String(amount))}
            className="gap-1.5 [&_label]:text-[13.5px] [&>p]:min-h-[1.4em] [&>p]:text-caption"
          />
        ) :
        (
          <SharesInput
            key="sell"
            symbol={stock.symbol}
            held={held}
            hint={shares !== null && shares > held ? "That's more than you have." : quoteHint(quote)}
            text={amountText}
            onChange={setAmountText}
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
