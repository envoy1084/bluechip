import { createFileRoute } from "@tanstack/react-router"
import { PortfolioScreen } from "../../../features/portfolio/screens/PortfolioScreen.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/portfolio/")({
  head: () => pageHead({ title: "Portfolio" }),
  component: PortfolioScreen
})
