import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import { type Intent, IntentRequest } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { Spinner } from "@bluechip/ui/components/spinner"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useId, useState } from "react"
import { cleanAmount, parseShares, parseUsdc } from "../../../../lib/amounts.ts"
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
  const amountId = useId()
  const [symbol, setSymbol] = useState<StockSymbol | null>(stocks[0] ?? null)
  const [side, setSide] = useState<Side>(sides[0] ?? "buy")
  const [text, setText] = useState("")
  const [asking, setAsking] = useState<Asking>({ status: "idle" })

  const amount = side === "buy" ? parseUsdc(text) : parseShares(text)
  const preview = useIntentPreview(agent.id, symbol, side, amount)

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
      <h3 id={`trade-${agent.id}`} className="px-0.5 text-label-sm font-semibold text-g-500">
        Trade with this agent
      </h3>
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
              <div className="flex flex-wrap items-center gap-2">
                {sides.length > 1 ?
                  (
                    <Tabs
                      variant="segmented"
                      value={side}
                      onValueChange={(value) => {
                        setSide(value as Side)
                        setText("")
                      }}
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
                  <span className="text-label-sm font-semibold">{side === "buy" ? "Buy" : "Sell"}</span>}
                <Select
                  items={stocks.map((stock) => ({ value: stock, label: nameOf(stock) }))}
                  value={symbol}
                  onValueChange={(value) => value !== null && setSymbol(value as StockSymbol)}
                >
                  <SelectTrigger size="sm" aria-label="Stock" className="min-w-[150px] flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stocks.map((stock) => <SelectItem key={stock} value={stock}>{nameOf(stock)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor={amountId} className="text-[13.5px] font-semibold">
                  {side === "buy" ? "How much to spend" : "How many shares to sell"}
                </label>
                <InputGroup>
                  {side === "buy" ? <InputGroupText>$</InputGroupText> : null}
                  <InputGroupInput
                    id={amountId}
                    value={text}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    onChange={(event) => setText(cleanAmount(event.currentTarget.value, side === "buy" ? 2 : 8))}
                    className="tabular-nums"
                  />
                  {side === "sell" ? <InputGroupText>shares</InputGroupText> : null}
                </InputGroup>
              </div>

              <div aria-live="polite" className="min-h-[1.4em]">
                {preview.status === "loading" ?
                  (
                    <p className="flex items-center gap-2 text-label-sm text-g-500">
                      <Spinner size={14} />Checking its policies…
                    </p>
                  ) :
                  null}
                {preview.status === "ready" ? <DecisionLine decision={preview.decision} /> : null}
                {preview.status === "failed" ? <p className="text-label-sm text-loss">{preview.message}</p> : null}
                {preview.status === "idle" ?
                  (
                    <p className="text-label-sm text-g-500">
                      Enter an amount to see what {agent.name}'s policies would do with it.
                    </p>
                  ) :
                  null}
              </div>

              {asking.status === "failed" ?
                (
                  <Alert variant="destructive">
                    <AlertDescription>{asking.message}</AlertDescription>
                  </Alert>
                ) :
                null}

              <Button
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
