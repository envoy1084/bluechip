import { createFileRoute } from "@tanstack/react-router"
import { StocksScreen } from "../../../features/stocks/screens/StocksScreen.tsx"

export const Route = createFileRoute("/_app/stocks/")({ component: StocksScreen })
