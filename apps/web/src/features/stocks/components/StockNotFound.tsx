import { ButtonLink } from "@bluechip/ui/components/button"
import { Empty, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { Link } from "@tanstack/react-router"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { MarketPill } from "../../../components/MarketPill.tsx"

/** A symbol that is malformed, or that bluechip doesn't trade. */
export function StockNotFound() {
  return (
    <AppPage title="Stock not found" actions={<MarketPill className="hidden sm:inline-flex" />}>
      <Empty>
        <EmptyTitle>We don't have that stock</EmptyTitle>
        <EmptyDescription>Check the symbol, or pick one from the list.</EmptyDescription>
        <ButtonLink variant="secondary" render={<Link to="/stocks" />}>See all stocks</ButtonLink>
      </Empty>
    </AppPage>
  )
}
