import { ButtonLink } from "@bluechip/ui/components/button"
import { Link } from "@tanstack/react-router"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { MarketPill } from "../../../components/MarketPill.tsx"

/** A symbol that is malformed, or that bluechip doesn't trade. */
export function StockNotFound() {
  return (
    <AppPage title="Stock not found" actions={<MarketPill className="hidden sm:inline-flex" />}>
      <IllustratedEmpty
        illustration="magnifier"
        size={120}
        title="We don't have that stock"
        action={<ButtonLink variant="secondary" render={<Link to="/stocks" />}>See all stocks</ButtonLink>}
      >
        Check the symbol, or pick one from the list.
      </IllustratedEmpty>
    </AppPage>
  )
}
