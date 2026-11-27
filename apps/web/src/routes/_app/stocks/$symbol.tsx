import { StockSymbol } from "@bluechip/domain/market/Market"
import { findTicker } from "@bluechip/ui/lib/tickers"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { StockNotFound } from "../../../features/stocks/components/StockNotFound.tsx"
import { StockScreen } from "../../../features/stocks/screens/StockScreen.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/stocks/$symbol")({
  head: ({ params }) => pageHead({ title: findTicker(params.symbol)?.name ?? params.symbol.toUpperCase() }),
  component: StockPage
})

const isStockSymbol = Schema.is(StockSymbol)

function StockPage() {
  const { symbol } = Route.useParams()
  return isStockSymbol(symbol) ? <StockScreen symbol={symbol} /> : <StockNotFound />
}
