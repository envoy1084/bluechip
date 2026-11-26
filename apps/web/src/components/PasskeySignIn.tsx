import type { Me } from "@bluechip/domain/Account"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { signInAtom } from "../atoms/account.ts"
import { passkeyProblem } from "../lib/passkeyProblem.ts"

/**
 * The one way to sign in: "Sign in with passkey", then home (or eligibility, until it is answered), or `onSignedIn`
 * where the page carries on by itself. A cancelled Face ID is a quiet note, not an error.
 */
export function PasskeySignIn(
  { variant = "secondary", label = "Sign in with passkey", onSignedIn }: Readonly<{
    variant?: "primary" | "secondary"
    label?: string
    onSignedIn?: (me: Me) => void
  }>
) {
  const signIn = useAtomSet(signInAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [state, setState] = useState<"idle" | "waiting" | "failed" | "cancelled">("idle")

  const start = () => {
    setState("waiting")
    signIn().then(
      (me) => {
        if (onSignedIn !== undefined) return onSignedIn(me)
        void navigate({ to: me.user.eligibility === "outsideUs" ? "/home" : "/welcome/eligibility" })
      },
      (error: unknown) => setState(passkeyProblem(error).cancelled ? "cancelled" : "failed")
    )
  }

  return (
    <>
      <Button size="lg" variant={variant} className="w-full" loading={state === "waiting"} onClick={start}>
        <Icon name="face-id" size={18} />
        {label}
      </Button>
      {state === "failed" ?
        (
          <Alert variant="warning" className="w-full text-left">
            <AlertTitle>We couldn't sign you in</AlertTitle>
            <AlertDescription>Try again, or create an account if this device has no bluechip passkey.</AlertDescription>
          </Alert>
        ) :
        state === "cancelled" ?
        <output className="block text-label-sm text-g-600">You cancelled Face ID. Sign in when you're ready.</output> :
        null}
    </>
  )
}
