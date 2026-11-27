import { createFileRoute } from "@tanstack/react-router"
import { StocksScreen } from "../../../features/stocks/screens/StocksScreen.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/stocks/")({
  head: () => pageHead({ title: "Stocks" }),
  component: StocksScreen
})
