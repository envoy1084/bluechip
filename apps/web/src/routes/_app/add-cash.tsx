import { useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { meAtom } from "../../atoms/account.ts"
import { AddCashPanel } from "../../funding/AddCashPanel.tsx"
import { AppPage } from "../../shell/AppPage.tsx"

export const Route = createFileRoute("/_app/add-cash")({ component: AddCash })

function AddCash() {
  const me = useAtomValue(meAtom)
  if (!AsyncResult.isSuccess(me)) return null

  return (
    <AppPage title="Add cash" sub="USDC on Base">
      <p className="text-body-sm text-g-600">
        Send USDC on Base to your bluechip account. It shows up here as soon as it lands.
      </p>
      <AddCashPanel address={me.value.account.address as `0x${string}`} />
    </AppPage>
  )
}
