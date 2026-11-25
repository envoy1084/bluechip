import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { signInAtom } from "../atoms/account.ts"
import { OnboardingFrame, OnboardingTitle } from "../shell/OnboardingFrame.tsx"

export const Route = createFileRoute("/signin")({ ssr: false, component: SignIn })

function SignIn() {
  const signIn = useAtomSet(signInAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [state, setState] = useState<"idle" | "waiting" | "failed">("idle")
  const start = () => {
    setState("waiting")
    signIn().then(
      (me) => navigate({ to: me.user.eligibility === "outsideUs" ? "/home" : "/welcome/eligibility" }),
      () => setState("failed")
    )
  }
  return (
    <OnboardingFrame>
      <Illustration name="passkey" size={56} />
      <OnboardingTitle title="Sign in to bluechip">Use the passkey you created your account with.</OnboardingTitle>
      {state === "failed" ?
        (
          <Alert variant="warning" className="w-full text-left">
            <AlertTitle>That didn't work</AlertTitle>
            <AlertDescription>Try again, or create an account if this device has no bluechip passkey.</AlertDescription>
          </Alert>
        ) :
        null}
      <div className="mt-2.5 grid w-full gap-2.5">
        <Button size="lg" className="w-full" loading={state === "waiting"} onClick={start}>
          <Icon name="face-id" size={18} />Sign in with Face ID
        </Button>
        <Button size="lg" variant="secondary" className="w-full" onClick={() => navigate({ to: "/welcome" })}>
          Create an account
        </Button>
      </div>
    </OnboardingFrame>
  )
}
