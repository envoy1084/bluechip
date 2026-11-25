import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { Badge } from "@bluechip/ui/components/badge"
import { Button } from "@bluechip/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bluechip/ui/components/card"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { meAtom, passkeysAtom, signOutAtom } from "../../atoms/account.ts"

export const Route = createFileRoute("/_app/settings")({ component: Settings })

const formatDate = (date: DateTime.Utc) =>
  DateTime.toDateUtc(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

function Settings() {
  const me = useAtomValue(meAtom)
  const passkeys = useAtomValue(passkeysAtom)
  const signOut = useAtomSet(signOutAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  if (!AsyncResult.isSuccess(me)) return null
  const { account, user } = me.value
  return (
    <div className="grid gap-6">
      <h1 className="text-display-3 font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your account on Base</CardTitle>
          <CardDescription>
            {account.deployed === true ?
              "Active on Base." :
              "Goes live on Base with its first transaction. You can already deposit to it."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <AddressChip address={account.address} />
          <Badge variant={user.eligibility === "outsideUs" ? "success" : "warning"}>
            {user.eligibility === "outsideUs" ? "Eligible to trade" : "Trading unavailable"}
          </Badge>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>The passkeys that sign you in and own your account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {AsyncResult.isSuccess(passkeys) ?
            passkeys.value.map((passkey) => (
              <div key={passkey.id} className="flex items-center justify-between rounded-md bg-g-50 px-3 py-2.5">
                <span className="text-body-sm font-medium">{passkey.label ?? "Passkey"}</span>
                <span className="text-caption text-g-500">
                  Added {formatDate(passkey.createdAt)}
                  {passkey.lastUsedAt === null ? "" : ` · last used ${formatDate(passkey.lastUsedAt)}`}
                </span>
              </div>
            )) :
            null}
        </CardContent>
      </Card>
      <div>
        <Button
          variant="secondary"
          loading={signingOut}
          onClick={async () => {
            setSigningOut(true)
            await signOut({ reactivityKeys: ["account"] }).finally(() => setSigningOut(false))
            await navigate({ to: "/signin" })
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  )
}
