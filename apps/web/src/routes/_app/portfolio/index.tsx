import { createFileRoute } from "@tanstack/react-router"
import { PortfolioScreen } from "../../../features/portfolio/screens/PortfolioScreen.tsx"

export const Route = createFileRoute("/_app/portfolio/")({ component: PortfolioScreen })
