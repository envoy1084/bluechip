import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { meAtom } from "../../atoms/account.ts"

export const Route = createFileRoute("/_app/home")({ component: Home })

function Home() {
  const me = useAtomValue(meAtom)
  if (!AsyncResult.isSuccess(me)) return null
  const { account, user } = me.value
  return (
    <div className="grid gap-6">
      <h1 className="text-display-3 font-semibold tracking-tight">
        {user.displayName === null ? "Welcome" : `Welcome, ${user.displayName}`}
      </h1>
      {user.eligibility === "us" ?
        (
          <Alert variant="warning">
            <AlertTitle>Trading isn't available for US persons</AlertTitle>
            <AlertDescription>Tokenized stocks on Base are offered outside the United States only.</AlertDescription>
          </Alert>
        ) :
        null}
      <DepositCard address={account.address} status="waiting" />
    </div>
  )
}
