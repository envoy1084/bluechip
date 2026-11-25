import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute, Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { meAtom } from "../../atoms/account.ts"
import { portfolioAtom } from "../../atoms/portfolio.ts"
import { MarketPill } from "../../market/MarketPill.tsx"
import { AppPage } from "../../shell/AppPage.tsx"
import { BalanceCard } from "./-components/BalanceCard.tsx"
import { LatestActivity } from "./-components/LatestActivity.tsx"

export const Route = createFileRoute("/_app/home")({ component: Home })

// The visitor's own day and time of day.
const today = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

const greeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

function Home() {
  const me = useAtomValue(meAtom)
  const portfolio = useAtomValue(portfolioAtom)
  if (!AsyncResult.isSuccess(me)) return null

  const { account, user } = me.value
  const empty = AsyncResult.isSuccess(portfolio) && portfolio.value.value === BigInt(0)

  return (
    <AppPage title="Home" actions={<MarketPill className="hidden sm:inline-flex" />}>
      <div className="grid gap-0.5">
        <span className="text-label-sm font-medium text-g-500">{today()}</span>
        <h2 className="text-[26px] font-semibold tracking-[-0.035em]">
          {user.displayName === null ? greeting() : `${greeting()}, ${user.displayName}`}
        </h2>
      </div>

      {AsyncResult.isSuccess(portfolio) && !empty && <BalanceCard portfolio={portfolio.value} />}

      <LatestActivity />

      {empty && (
        <DepositCard
          address={account.address}
          status="waiting"
          footer={
            <Button size="sm" nativeButton={false} render={<Link to="/add-cash" />}>
              <Icon name="plus" size={14} />Add cash
            </Button>
          }
        />
      )}
    </AppPage>
  )
}
