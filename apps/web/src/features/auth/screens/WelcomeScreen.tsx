import type { Me } from "@bluechip/domain/Account"
import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { Seal } from "@bluechip/ui/motion/seal"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { OnboardingFrame, OnboardingTitle } from "../../../components/layout/OnboardingFrame.tsx"
import { PasskeySignIn } from "../../../components/PasskeySignIn.tsx"
import { SignedInRedirect } from "../../../components/SignedInRedirect.tsx"
import { signUpAtom } from "../atoms/auth.ts"

type Phase =
  | { readonly _tag: "Start"; readonly creating: boolean; readonly failed: boolean }
  | { readonly _tag: "Created"; readonly me: Me }

export function WelcomeScreen() {
  const signUp = useAtomSet(signUpAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ _tag: "Start", creating: false, failed: false })

  const create = () => {
    setPhase({ _tag: "Start", creating: true, failed: false })
    signUp(undefined).then(
      (me) => setPhase({ _tag: "Created", me }),
      () => setPhase({ _tag: "Start", creating: false, failed: true })
    )
  }

  if (phase._tag === "Start") {
    return (
      <OnboardingFrame step="Account">
        <SignedInRedirect />
        <div className="-mb-1.5 size-[210px]">
          <Halftone scene="logo" className="size-full" />
        </div>
        <OnboardingTitle title="Let agents invest for you, inside your limits">
          Agents trade tokenized US stocks for you, only within limits you set.
        </OnboardingTitle>
        {phase.failed ?
          (
            <Alert variant="warning" className="w-full text-left">
              <AlertTitle>Your passkey wasn't created</AlertTitle>
              <AlertDescription>Nothing was saved. Try again when you're ready.</AlertDescription>
            </Alert>
          ) :
          null}
        <div className="mt-2.5 grid w-full gap-2.5">
          <Button size="lg" className="w-full" loading={phase.creating} onClick={create}>
            <Icon name="face-id" size={18} />Create account with Face ID
          </Button>
          <PasskeySignIn />
        </div>
        <p className="text-[12px] text-g-500">
          By continuing you agree to the{" "}
          <Link to="/legal/terms" className="font-medium text-g-700 underline underline-offset-2">Terms</Link> and the
          {" "}
          <Link to="/legal/risk" className="font-medium text-g-700 underline underline-offset-2">Risk disclosure</Link>.
        </p>
      </OnboardingFrame>
    )
  }

  return (
    <OnboardingFrame step="Account">
      <section className="grid w-full animate-slide-up justify-items-center gap-1.5 rounded-[30px] bg-white/90 px-6 pt-7 pb-6 shadow-e4">
        <Seal playing className="mb-1 size-[136px]" label="Passkey saved" />
        <OnboardingTitle title="Your account is ready" />
        <p className="text-label-sm text-gain">Passkey saved with Face ID</p>
        <div className="mt-4 grid w-full justify-items-center gap-2 border-t border-g-100 pt-5">
          <span className="text-label-sm font-medium text-g-500">Your account on Base</span>
          <AddressChip address={phase.me.account.address} />
          <Button size="lg" className="mt-4 w-full" onClick={() => navigate({ to: "/welcome/eligibility" })}>
            Continue<Icon name="arrow-right" size={16} />
          </Button>
        </div>
      </section>
    </OnboardingFrame>
  )
}
