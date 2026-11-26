import { createFileRoute } from "@tanstack/react-router"
import { KitTrading } from "../pages/trading/page.tsx"

export const Route = createFileRoute("/trading")({ component: KitTrading })
