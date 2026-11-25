import type { Stock } from "@bluechip/domain/market/Market"
import { MoneyInput } from "@bluechip/ui/bluechip/money-input"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { useState } from "react"
import { type QuoteSide, useQuote } from "../../../../market/useQuote.ts"
import { QuoteSummary, QuoteSummarySkeleton } from "./QuoteSummary.tsx"

const sharesText = (text: string) => {
  const [whole = "", ...rest] = text.replace(/[^\d.]/g, "").split(".")
  return rest.length === 0 ? whole : `${whole}.${rest.join("").slice(0, 8)}`
}

function SharesInput({ symbol, onChange }: Readonly<{ symbol: string; onChange: (text: string) => void }>) {
  const [text, setText] = useState("")
  return (
    <div className="grid gap-2">
      <label htmlFor="sell-shares" className="text-body-sm font-semibold">Sell {symbol}</label>
      <InputGroup className="h-auto rounded-[14px] py-2.5 pr-2.5 pl-4">
        <InputGroupInput
          id="sell-shares"
          value={text}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          onChange={(event) => {
            const next = sharesText(event.currentTarget.value)
            setText(next)
            onChange(next)
          }}
          className="text-[32px] leading-[1.2] font-semibold tracking-[-0.035em] tabular-nums placeholder:text-g-300"
        />
        <InputGroupText className="pr-1.5 font-semibold text-g-500">shares</InputGroupText>
      </InputGroup>
    </div>
  )
}

/** Quote a buy or a sell of one stock. Trading itself arrives in a later update, so the action stays off. */
export function QuoteBox({ stock }: Readonly<{ stock: Stock }>) {
  const [side, setSide] = useState<QuoteSide>("buy")
  const [amountText, setAmountText] = useState("")
  const quote = useQuote(stock.symbol, side, stock.tradable ? amountText : "")

  return (
    <section className="grid gap-4 rounded-lg bg-white p-5 shadow-e2" aria-label={`Trade ${stock.name}`}>
      <Tabs
        variant="segmented"
        value={side}
        onValueChange={(value) => {
          setSide(value as QuoteSide)
          setAmountText("")
        }}
      >
        <TabsList aria-label="Buy or sell">
          <TabsTab value="buy">Buy</TabsTab>
          <TabsTab value="sell">Sell</TabsTab>
        </TabsList>
      </Tabs>

      {stock.tradable ?
        side === "buy" ?
          (
            <MoneyInput
              key="buy"
              label={`Buy ${stock.name} with`}
              description="Cash (USDC)"
              currency="usdc"
              size="md"
              showMax={false}
              quickAmounts={[50, 100, 250]}
              onValueChange={(amount) => setAmountText(amount === null ? "" : String(amount))}
            />
          ) :
          <SharesInput key="sell" symbol={stock.symbol} onChange={setAmountText} /> :
        (
          <Alert variant="info">
            <AlertDescription>{stock.name} doesn't have a pool to trade in yet.</AlertDescription>
          </Alert>
        )}

      {quote.status === "loading" && <QuoteSummarySkeleton />}
      {quote.status === "ready" && <QuoteSummary quote={quote.quote} />}
      {quote.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>{quote.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2">
        <Button size="lg" disabled>{side === "buy" ? "Buy" : "Sell"} {stock.symbol}</Button>
        <p className="text-center text-label-sm text-g-500">Trading opens in the next update</p>
      </div>
    </section>
  )
}
