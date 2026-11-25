import type { Me } from "@bluechip/domain/Account"
import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { Seal } from "@bluechip/ui/motion/seal"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { signInAtom, signUpAtom } from "../../atoms/account.ts"
import { OnboardingFrame, OnboardingTitle } from "../../shell/OnboardingFrame.tsx"

export const Route = createFileRoute("/welcome/")({ ssr: false, component: Welcome })

type Phase =
  | { readonly _tag: "Start"; readonly failed: boolean }
  | { readonly _tag: "Creating" }
  | { readonly _tag: "Created"; readonly me: Me; readonly revealed: boolean }

function Welcome() {
  const signUp = useAtomSet(signUpAtom, { mode: "promise" })
  const signIn = useAtomSet(signInAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ _tag: "Start", failed: false })
  const [signingIn, setSigningIn] = useState(false)

  const create = () => {
    setPhase({ _tag: "Creating" })
    signUp(undefined).then(
      (me) => setPhase({ _tag: "Created", me, revealed: false }),
      () => setPhase({ _tag: "Start", failed: true })
    )
  }
  const existing = () => {
    setSigningIn(true)
    signIn().then(
      (me) => navigate({ to: me.user.eligibility === "outsideUs" ? "/home" : "/welcome/eligibility" }),
      () => setSigningIn(false)
    )
  }

  if (phase._tag === "Start") {
    return (
      <OnboardingFrame>
        <div className="-mb-1.5 size-[210px]">
          <Halftone scene="logo" className="size-full" />
        </div>
        <OnboardingTitle title="Let agents invest for you, inside your limits">
          bluechip agents trade tokenized US stocks for you. They can only do what you allow, and only your Face ID can
          change that.
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
          <Button size="lg" className="w-full" onClick={create}>
            <Icon name="face-id" size={18} />Create account with Face ID
          </Button>
          <Button size="lg" variant="secondary" className="w-full" loading={signingIn} onClick={existing}>
            Sign in with Face ID
          </Button>
        </div>
        <p className="text-[12px] text-g-500">By continuing you agree to the Terms and the Risk disclosure.</p>
      </OnboardingFrame>
    )
  }

  const created = phase._tag === "Created"
  return (
    <OnboardingFrame step="Account">
      <output className="my-2 grid w-[min(300px,100%)] justify-items-center gap-1.5 rounded-[30px] bg-white/90 px-[22px] pt-[26px] pb-6 shadow-e4">
        <Seal
          playing={created}
          className="mb-1 size-[136px]"
          label={created ? "Passkey saved" : "Waiting for Face ID"}
          onDone={() => created && setPhase({ ...phase, revealed: true })}
        />
        <b className={cn("text-base font-semibold tracking-[-0.015em]", created && "text-gain")}>
          {created ? "Passkey saved" : "Creating your account"}
        </b>
        <span className="text-label-sm text-g-500">
          {created ? "Signed in with Face ID" : "Use Face ID to create a passkey for bluechip."}
        </span>
      </output>
      {created && phase.revealed ?
        (
          <div className="grid w-full animate-fade-in justify-items-center gap-3">
            <OnboardingTitle title="Your account is ready">
              No password and no seed phrase. Only your Face ID can move money out or change an agent's limits.
            </OnboardingTitle>
            <div className="my-1 grid w-full justify-items-center gap-2 rounded-lg bg-white p-4 shadow-e1">
              <span className="text-label-sm font-medium text-g-500">Your account on Base</span>
              <AddressChip address={phase.me.account.address} />
            </div>
            <Button size="lg" className="w-full" onClick={() => navigate({ to: "/welcome/eligibility" })}>
              Continue<Icon name="arrow-right" size={16} />
            </Button>
          </div>
        ) :
        null}
    </OnboardingFrame>
  )
}
