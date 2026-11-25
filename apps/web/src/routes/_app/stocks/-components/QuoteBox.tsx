import type { Stock } from "@bluechip/domain/market/Market"
import { MoneyInput } from "@bluechip/ui/bluechip/money-input"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatTokenAmount } from "@bluechip/ui/lib/format"
import { UsdcLogo } from "@bluechip/ui/logos/usdc"
import { useState } from "react"
import { shareCount } from "../../../../market/amounts.ts"
import { type QuoteSide, type QuoteState, useQuote } from "../../../../market/useQuote.ts"
import { QuoteSummary, QuoteSummarySkeleton } from "./QuoteSummary.tsx"

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
  { symbol, hint, onChange }: Readonly<{ symbol: string; hint: string | null; onChange: (text: string) => void }>
) {
  const [text, setText] = useState("")
  return (
    <div className="grid gap-1.5">
      <label htmlFor="sell-shares" className="text-[13.5px] font-semibold">Sell {symbol}</label>
      <InputGroup className="h-auto rounded-[10px] bg-g-50 py-1.5 pr-2.5 pl-2.5 focus-within:bg-white">
        <InputGroupInput
          id="sell-shares"
          value={text}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-describedby="sell-shares-hint"
          onChange={(event) => {
            const next = sharesText(event.currentTarget.value)
            setText(next)
            onChange(next)
          }}
          className="text-[18px] font-semibold tracking-[-0.02em] tabular-nums placeholder:text-g-300"
        />
        <InputGroupText className="font-semibold text-g-500">shares</InputGroupText>
      </InputGroup>
      <p id="sell-shares-hint" aria-live="polite" className="min-h-[1.4em] text-caption text-g-500">
        {hint ?? "Enter how many shares to sell."}
      </p>
    </div>
  )
}

/** Quote a buy or a sell of one stock. Trading itself arrives in a later update, so the action stays off. */
export function QuoteBox({ stock }: Readonly<{ stock: Stock }>) {
  const [side, setSide] = useState<QuoteSide>("buy")
  const [amountText, setAmountText] = useState("")
  const quote = useQuote(stock.symbol, side, stock.tradable ? amountText : "")
  const hint = quoteHint(quote)

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
                Cash (USDC)
              </span>
            }
            currency="usdc"
            size="md"
            showMax={false}
            quickAmounts={[50, 100, 150]}
            hint={hint}
            emptyHint="Enter an amount. The smallest trade is $1."
            onValueChange={(amount) => setAmountText(amount === null ? "" : String(amount))}
            className="gap-1.5 [&_label]:text-[13.5px] [&>p]:min-h-[1.4em] [&>p]:text-caption"
          />
        ) :
        <SharesInput key="sell" symbol={stock.symbol} hint={hint} onChange={setAmountText} />}

      {quote.status === "loading" && <QuoteSummarySkeleton />}
      {quote.status === "ready" && <QuoteSummary stock={stock} quote={quote.quote} />}
      {quote.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>{quote.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2">
        <Button size="lg" disabled>
          <Icon name="face-id" size={18} />
          {side === "buy" ? "Buy" : "Sell"} with Face ID
        </Button>
        <p className="text-center text-label-sm text-g-500">Trading opens in the next update</p>
      </div>
    </section>
  )
}
