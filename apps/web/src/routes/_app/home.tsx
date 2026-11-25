import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { meAtom } from "../../atoms/account.ts"
import { AppPage } from "../../shell/AppPage.tsx"

export const Route = createFileRoute("/_app/home")({ component: Home })

// The visitor's own day and time of day.
const today = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

const greeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

function Home() {
  const me = useAtomValue(meAtom)
  if (!AsyncResult.isSuccess(me)) return null
  const { account, user } = me.value
  return (
    <AppPage title="Home">
      <div className="grid gap-0.5">
        <span className="text-label-sm font-medium text-g-500">{today()}</span>
        <h2 className="text-[26px] font-semibold tracking-[-0.035em]">
          {user.displayName === null ? greeting() : `${greeting()}, ${user.displayName}`}
        </h2>
      </div>
      <DepositCard address={account.address} status="waiting" />
    </AppPage>
  )
}
