import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import {
  ChatResultHeadline,
  ChatResultRow,
  ChatResultRows,
  ChatResultStat,
  ChatResultStats
} from "@bluechip/ui/bluechip/chat-result"
import { OutcomeLink } from "@bluechip/ui/bluechip/outcome"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { formatChange, formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { bpsPercent, priceDollars, shareCount, usdcDollars } from "../../../../lib/amounts.ts"
import { stockDayAtom } from "../../atoms/assistant.ts"
import type { ResultState, StockRead } from "../../model/resultCards.ts"
import { RESULT_LOOK } from "../../model/resultText.ts"
import { LookedResult } from "./MoneyResults.tsx"
import { OpenLink } from "./OpenLink.tsx"

const price = (stock: Stock) => stock.price === null ? null : priceDollars(stock.price.price)

/** How far the market is from Chainlink's price, in percent of Chainlink's. */
const apart = (stock: Stock): number | null => {
  if (stock.price === null || stock.reference === null || stock.reference.price === BigInt(0)) return null
  return Number((stock.price.price - stock.reference.price) * BigInt(10_000) / stock.reference.price) / 100
}

/** The stock's past day; nothing until it loads, or when there is too little to draw. */
function DaySparkline({ symbol }: Readonly<{ symbol: StockSymbol }>) {
  const history = useAtomValue(stockDayAtom(symbol))
  const values = AsyncResult.isSuccess(history) ? history.value.map((point) => priceDollars(point.price)) : []
  if (values.length < 2) return null
  return <Sparkline values={values} width={88} height={28} label="Past day" />
}

/**
 * One stock as the turn read it: its price and day with Chainlink's price beside the market's, your holding and its
 * profit when they were read, and its token on Base when its facts were.
 */
export function StockResult(
  { read, state, nameOf }: Readonly<{ read: StockRead; state: ResultState; nameOf: (symbol: StockSymbol) => string }>
) {
  const { facts, performance, stock, symbol } = read
  const gap = stock === null ? null : apart(stock)
  const profit = performance === null ? null : performance.realised + performance.unrealised

  return (
    <LookedResult
      look={{ ...RESULT_LOOK.getStock, title: nameOf(symbol) }}
      media={<TickerChip symbol={symbol} size="sm" />}
      state={state}
      action={<OpenLink to="/stocks/$symbol" params={{ symbol }} />}
    >
      {stock === null || stock.price === null ?
        null :
        (
          <ChatResultHeadline
            value={formatMoney(price(stock) ?? 0)}
            change={stock.change24h === null
              ? undefined
              : <PriceChange size="sm" value={bpsPercent(stock.change24h)} />}
            detail={stock.tradable ? "A share, since the previous close" : "A share. Not tradable on bluechip yet."}
            aside={<DaySparkline symbol={symbol} />}
          />
        )}
      {stock === null || stock.reference === null ?
        null :
        (
          <ChatResultStats>
            <ChatResultStat label="Market" value={stock.price === null ? "None" : formatMoney(price(stock) ?? 0)} />
            <ChatResultStat label="Chainlink" value={formatMoney(priceDollars(stock.reference.price))} />
            <ChatResultStat label="Apart" value={gap === null ? "Unknown" : `${Math.abs(gap).toFixed(2)}%`} />
          </ChatResultStats>
        )}
      {performance === null || profit === null ?
        null :
        (
          <ChatResultStats>
            <ChatResultStat label="You hold" value={formatShareCount(shareCount(performance.shares))} />
            <ChatResultStat label="Worth" value={formatMoney(usdcDollars(performance.value))} />
            <ChatResultStat
              label="Profit"
              value={formatChange(usdcDollars(profit))}
              tone={profit < BigInt(0) ? "loss" : profit > BigInt(0) ? "gain" : "plain"}
            />
          </ChatResultStats>
        )}
      {facts === null ?
        null :
        (
          <div className="grid gap-1">
            <p className="text-label text-g-700">{facts.facts}</p>
            <OutcomeLink href={facts.url} className="justify-self-start">Its token on BaseScan</OutcomeLink>
          </div>
        )}
    </LookedResult>
  )
}

/** Several stocks' prices as compact rows, each to its page. */
export function PricesResult(
  { stocks, state }: Readonly<{ stocks: ReadonlyArray<Stock>; state: ResultState }>
) {
  return (
    <LookedResult look={RESULT_LOOK.getPrices} state={state} action={<OpenLink label="All stocks" to="/stocks" />}>
      <ChatResultRows>
        {stocks.map((stock) => (
          <ChatResultRow
            key={stock.symbol}
            media={<TickerChip symbol={stock.symbol} size="sm" />}
            title={stock.name}
            detail={stock.reference === null ?
              "No Chainlink price" :
              `Chainlink ${formatMoney(priceDollars(stock.reference.price))}`}
            value={stock.price === null ? "No price" : formatMoney(price(stock) ?? 0)}
            valueDetail={stock.change24h === null
              ? undefined
              : <PriceChange size="sm" value={bpsPercent(stock.change24h)} />}
          />
        ))}
      </ChatResultRows>
    </LookedResult>
  )
}
