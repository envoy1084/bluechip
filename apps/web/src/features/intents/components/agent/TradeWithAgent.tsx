import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import { type Intent, IntentRequest } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { cn } from "@bluechip/ui/lib/cn"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { stocksAtom } from "../../../../atoms/market.ts"
import { portfolioAtom } from "../../../../atoms/portfolio.ts"
import { AmountInput, type AmountUnit } from "../../../../components/fields/AmountInput.tsx"
import { SectionHeader } from "../../../../components/layout/SectionHeader.tsx"
import { QuoteSummary, QuoteSummarySkeleton } from "../../../../components/trading/QuoteSummary.tsx"
import { useQuote } from "../../../../hooks/useQuote.ts"
import { parseShares, parseUsdc, shareCount, usdcDollars } from "../../../../lib/amounts.ts"
import { createIntentAtom } from "../../atoms/intents.ts"
import { useIntentPreview } from "../../hooks/useIntentPreview.ts"
import { intentProblem } from "../../model/intentText.ts"
import { DecisionLine } from "../DecisionLine.tsx"
import { AgentTradeProgress } from "./AgentTradeProgress.tsx"

type Side = "buy" | "sell"

type Asking =
  | { readonly status: "idle" }
  | { readonly status: "asking" }
  | { readonly status: "asked"; readonly intent: Intent }
  | { readonly status: "failed"; readonly message: string }

/** The ways its trade policy lets it go: buy, sell or both (a rebalancer does both). */
const sidesOf = (agent: Agent): ReadonlyArray<Side> => {
  const direction = configOf(agent.spec.policies, trade)?.direction ?? "both"
  return direction === "buy" ? ["buy"] : direction === "sell" ? ["sell"] : ["buy", "sell"]
}

/**
 * Asking the agent for one trade: a stock it may trade, buy or sell, and how much (dollars to spend, shares to sell).
 * While you type, its policies say what would happen: it sends it, it needs your Face ID, a policy blocks it, or it
 * waits. Then the card follows the trade live.
 */
export function TradeWithAgent(
  { agent, nameOf }: Readonly<{ agent: Agent; nameOf: (symbol: StockSymbol) => string }>
) {
  const stocks = configOf(agent.spec.policies, trade)?.stocks ?? []
  const sides = sidesOf(agent)
  const create = useAtomSet(createIntentAtom, { mode: "promise" })
  const [symbol, setSymbol] = useState<StockSymbol | null>(stocks[0] ?? null)
  const [side, setSide] = useState<Side>(sides[0] ?? "buy")
  const [text, setText] = useState("")
  const [unit, setUnit] = useState<AmountUnit>(side === "buy" ? "usd" : "shares")
  const [asking, setAsking] = useState<Asking>({ status: "idle" })
  const allStocks = useAtomValue(stocksAtom)
  const stock = AsyncResult.isSuccess(allStocks) ? allStocks.value.find((each) => each.symbol === symbol) : undefined
  const price = stock?.price?.price ?? stock?.reference?.price ?? null

  const portfolio = useAtomValue(portfolioAtom)
  const cash = AsyncResult.isSuccess(portfolio) ? portfolio.value.cash : BigInt(0)
  const held = AsyncResult.isSuccess(portfolio) && symbol !== null ?
    portfolio.value.holdings.find((holding) => holding.symbol === symbol)?.shares ?? BigInt(0) :
    BigInt(0)
  // What the trade moves in its own unit: USDC spent for a buy, shares sold for a sell, converted at today's price
  // when typed in the other unit.
  const typed = unit === "usd" ? parseUsdc(text) : parseShares(text)
  const amount = typed === null ?
    null :
    side === "buy" ?
    (unit === "usd" ? typed : price === null ? null : valueOf(Shares.make(typed), price)) :
    (unit === "shares" ? typed : price === null ? null : sharesFor(Usdc.make(typed), price))
  const preview = useIntentPreview(agent.id, symbol, side, amount)
  const quote = useQuote(symbol ?? ("" as StockSymbol), side, symbol === null ? null : amount as Usdc | Shares | null)

  const switchUnit = (next: AmountUnit) => {
    // Keep the same amount, said in the other unit.
    if (typed !== null && price !== null) {
      setText(
        next === "shares" ?
          String(shareCount(sharesFor(Usdc.make(typed), price))) :
          usdcDollars(valueOf(Shares.make(typed), price)).toFixed(2)
      )
    }
    setUnit(next)
  }

  const ask = async () => {
    if (symbol === null || amount === null) return
    setAsking({ status: "asking" })
    try {
      const asked = await create({
        payload: {
          requestId: crypto.randomUUID() as RequestId,
          agentId: agent.id,
          leg: { symbol, side, amount: side === "buy" ? { usdc: Usdc.make(amount) } : { shares: Shares.make(amount) } }
        }
      })
      setAsking({ status: "asked", intent: asked instanceof IntentRequest ? asked.intent : asked })
    } catch (error) {
      setAsking({ status: "failed", message: intentProblem(error, side) })
    }
  }

  if (stocks.length === 0) return null

  return (
    <section aria-labelledby={`trade-${agent.id}`} className="grid content-start gap-2.5">
      <SectionHeader
        id={`trade-${agent.id}`}
        level="h3"
        title="Trade with this agent"
        description="Its rules decide before anything is sent."
      />
      <div className="grid gap-3.5 rounded-lg bg-white p-[18px] shadow-e2">
        {asking.status === "asked" ?
          (
            <AgentTradeProgress
              intent={asking.intent}
              nameOf={nameOf}
              onDone={() => {
                setAsking({ status: "idle" })
                setText("")
              }}
            />
          ) :
          (
            <>
              {sides.length > 1 ?
                (
                  <Tabs
                    variant="segmented"
                    value={side}
                    onValueChange={(value) => {
                      setSide(value as Side)
                      setUnit(value === "buy" ? "usd" : "shares")
                      setText("")
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
                ) :
                null}

              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-[13.5px] font-semibold">Stock</legend>
                <div className="flex flex-wrap gap-1.5">
                  {stocks.map((stock) => (
                    <button
                      key={stock}
                      type="button"
                      aria-pressed={symbol === stock}
                      onClick={() => setSymbol(stock)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-2 rounded-[10px] py-1 pr-3 pl-1 text-[13.5px] font-medium shadow-[inset_0_0_0_1px_var(--color-g-200)] transition-[background,box-shadow] duration-fast ease-brand hover:bg-g-50",
                        symbol === stock && "bg-blue-50 shadow-[inset_0_0_0_1.5px_var(--color-blue)] hover:bg-blue-50"
                      )}
                    >
                      <TickerChip symbol={stock} size="sm" />
                      {nameOf(stock)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <AmountInput
                label={side === "buy"
                  ? `Buy ${symbol === null ? "" : nameOf(symbol)}`
                  : `Sell ${symbol === null ? "" : nameOf(symbol)}`}
                available={side === "buy" ?
                  `${formatMoney(usdcDollars(cash))} cash available` :
                  `${formatShareCount(shareCount(held))}`}
                unit={unit}
                symbol={symbol ?? ""}
                text={text}
                hint={null}
                invalid={false}
                quickAmounts={side === "buy" ? [50, 100, 150] : []}
                onTextChange={setText}
                onUnitChange={switchUnit}
                onMax={(side === "buy" ? cash : held) === BigInt(0) || price === null ? undefined : () => {
                  // All the cash for a buy, every share for a sell, in the unit shown.
                  if (price === null) return
                  const all = side === "buy" ? cash : held
                  const inUsd = side === "buy" ? all : valueOf(Shares.make(all), price)
                  const inShares = side === "sell" ? all : sharesFor(Usdc.make(all), price)
                  setText(unit === "usd" ? String(usdcDollars(inUsd)) : String(shareCount(inShares)))
                }}
              />

              {stock !== undefined && quote.status === "loading" && <QuoteSummarySkeleton stock={stock} side={side} />}
              {stock !== undefined && quote.status === "ready" && <QuoteSummary stock={stock} quote={quote.quote} />}
              {quote.status === "failed" && <p className="text-label-sm text-loss">{quote.message}</p>}

              <div aria-live="polite" className="empty:hidden">
                {preview.status === "loading" ?
                  (
                    <p className="flex items-center gap-2 text-label-sm text-g-500">
                      <Spinner size={14} />Checking its policies…
                    </p>
                  ) :
                  null}
                {preview.status === "ready" ? <DecisionLine decision={preview.decision} /> : null}
                {preview.status === "failed" ? <p className="text-label-sm text-loss">{preview.message}</p> : null}
              </div>

              {asking.status === "failed" ?
                (
                  <Alert variant="destructive">
                    <AlertDescription>{asking.message}</AlertDescription>
                  </Alert>
                ) :
                null}

              <Button
                size="lg"
                disabled={symbol === null || amount === null}
                loading={asking.status === "asking"}
                onClick={() => void ask()}
              >
                Ask {agent.name} to {side === "buy" ? "buy" : "sell"}
              </Button>
            </>
          )}
      </div>
    </section>
  )
}
