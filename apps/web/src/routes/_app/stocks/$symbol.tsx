import { StockSymbol } from "@bluechip/domain/market/Market"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { StockNotFound } from "../../../features/stocks/components/StockNotFound.tsx"
import { StockScreen } from "../../../features/stocks/screens/StockScreen.tsx"

export const Route = createFileRoute("/_app/stocks/$symbol")({ component: StockPage })

const isStockSymbol = Schema.is(StockSymbol)

function StockPage() {
  const { symbol } = Route.useParams()
  return isStockSymbol(symbol) ? <StockScreen symbol={symbol} /> : <StockNotFound />
}
