import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { ReactNode } from "react"
import { meAtom } from "../../../atoms/account.ts"
import { cashDialogAtom } from "../../../atoms/cashDialog.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { MarketPill } from "../../../components/MarketPill.tsx"
import { BalanceCard } from "../components/BalanceCard.tsx"

// The visitor's own day and time of day.
const today = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

const greeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

const SUGGESTIONS = ["What did my agents do today?", "How did I do this week?", "Create an agent that only rebalances"]

/**
 * The day's greeting, the balance (or the way to add cash when there is none), the way to ask bluechip, and the
 * latest activity. `approvals` is the approvals bell, from the intents feature; `latest` the latest activity.
 */
export function HomeScreen({ approvals, latest }: Readonly<{ approvals: ReactNode; latest: ReactNode }>) {
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
        <span className="text-label-sm font-medium text-g-500">
          {today()}
        </span>
        <h2 className="text-[26px] font-semibold tracking-[-0.035em]">
          {user.displayName === null ? greeting() : `${greeting()}, ${user.displayName}`}
        </h2>
      </div>

      {AsyncResult.isSuccess(portfolio) && !empty && <BalanceCard portfolio={portfolio.value} />}

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

      <section aria-labelledby="ask-bluechip" className="grid gap-2.5 rounded-lg bg-white px-5 py-[18px] shadow-e2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="ask-bluechip" className="text-body-sm font-semibold">Ask bluechip</h2>
          <ButtonLink size="sm" render={<Link to="/chat/{-$conversationId}" params={{ conversationId: undefined }} />}>
            <Icon name="chat" size={14} />New chat
          </ButtonLink>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <Link
                to="/chat/{-$conversationId}"
                params={{ conversationId: undefined }}
                search={{ ask: suggestion }}
                className="inline-flex rounded-full bg-g-50 px-[11px] py-1.5 text-label-sm font-medium text-g-700 shadow-[0_0_0_1px_rgba(10,11,13,.08)] transition-[box-shadow,color] duration-fast ease-brand hover:text-ink hover:shadow-[0_0_0_1px_rgba(42,91,255,.3)]"
              >
                {suggestion}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {latest}
    </AppPage>
  )
}
