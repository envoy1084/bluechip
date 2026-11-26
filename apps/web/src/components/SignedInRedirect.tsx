import { useAtomValue } from "@effect/atom-react/Hooks"
import { ClientOnly, Navigate } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { meAtom } from "../atoms/account.ts"

/**
 * Sends a visitor who arrives already signed in on to home (or eligibility, until it is answered). Decided once, on
 * arrival: signing up or in on the page carries on there, it isn't yanked away. Runs in the browser only, where the
 * session cookie is.
 */
export function SignedInRedirect() {
  return (
    <ClientOnly>
      <Redirect />
    </ClientOnly>
  )
}

function Redirect() {
  const me = useAtomValue(meAtom)
  // Where the visitor stood on arrival, decided once from the first settled answer.
  const [arrival, setArrival] = useState<"/home" | "/welcome/eligibility" | "signedOut" | null>(null)

  // A session that just ended (signing out on the way here) is still being read again: wait for the answer.
  if (arrival === null && !AsyncResult.isInitial(me) && !AsyncResult.isWaiting(me)) {
    setArrival(
      !AsyncResult.isSuccess(me) ?
        "signedOut" :
        me.value.user.eligibility === "outsideUs" ?
        "/home" :
        "/welcome/eligibility"
    )
  }

  return arrival === null || arrival === "signedOut" ? null : <Navigate to={arrival} replace />
}
