import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { ReactNode } from "react"
import { meAtom } from "../../../atoms/account.ts"
import { cashDialogAtom } from "../../../atoms/cashDialog.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { MarketPill } from "../../../components/MarketPill.tsx"
import { BalanceCard } from "../components/BalanceCard.tsx"
import { LatestActivity } from "../components/LatestActivity.tsx"

// The visitor's own day and time of day.
const today = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

const greeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

/**
 * The day's greeting, the balance, the latest activity, and the way to add cash when there is none. `approvals` is
 * the approvals bell, from the intents feature.
 */
export function HomeScreen({ approvals }: Readonly<{ approvals: ReactNode }>) {
  const me = useAtomValue(meAtom)
  const portfolio = useAtomValue(portfolioAtom)
  const openCash = useAtomSet(cashDialogAtom)
  if (!AsyncResult.isSuccess(me)) return null

  const { account, user } = me.value
  const empty = AsyncResult.isSuccess(portfolio) && portfolio.value.value === BigInt(0)

  return (
    <AppPage
      title="Home"
      actions={
        <>
          <MarketPill className="hidden sm:inline-flex" />
          {approvals}
        </>
      }
    >
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
            <Button size="sm" onClick={() => openCash("add")}>
              <Icon name="plus" size={14} />Add cash
            </Button>
          }
        />
      )}
    </AppPage>
  )
}
