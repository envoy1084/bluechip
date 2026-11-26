import type { Recovering } from "@bluechip/domain/recovery/Recovery"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import { useEffect, useState } from "react"
import { OnboardingFrame, OnboardingTitle } from "../../../components/layout/OnboardingFrame.tsx"
import { PasskeySignIn } from "../../../components/PasskeySignIn.tsx"
import { accountReactivityKey } from "../../../lib/api/client.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import {
  executeRecoveryAtom,
  recoveringAtom,
  recoverySignInAtom,
  requestRecoveryAtom,
  signInRecoveredAtom
} from "../atoms/recover.ts"
import { recoverProblem, recoverStep } from "../model/recoverText.ts"

/**
 * Recovering an account with its recovery passkey, from a device with none of its passkeys: sign in with the recovery
 * key, ask for the recovery (this device's new passkey replaces the old ones 48 hours later), and make it once due:
 * once it lands, this device is signed in with its new passkey.
 */
export function RecoverScreen() {
  const signIn = useAtomSet(recoverySignInAtom, { mode: "promise" })
  const reload = useAtomSet(recoveringAtom, { mode: "promise" })
  const request = useAtomSet(requestRecoveryAtom, { mode: "promise" })
  const execute = useAtomSet(executeRecoveryAtom, { mode: "promise" })
  const signInRecovered = useAtomSet(signInRecoveredAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [recovering, setRecovering] = useState<Recovering | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | undefined>(undefined)

  const step = recovering === undefined ? undefined : recoverStep(recovering, DateTime.nowUnsafe(), localTimeZone())

  // While Base takes a step there's no live stream for a recovery session: look again every few seconds.
  useEffect(() => {
    if (step?.tone !== "pending") return
    const timer = setInterval(() => void reload().then(setRecovering, () => undefined), 3000)
    return () => clearInterval(timer)
  }, [step?.tone, reload])

  // The recovery this device made landed: it is signed in with its new passkey, and goes home. Another device (or a
  // recovery sign-in that ended) signs in with the new passkey by hand.
  const completed = step?.offer === "signIn"
  useEffect(() => {
    if (!completed) return
    void signInRecovered({ reactivityKeys: [accountReactivityKey] }).then(
      () => navigate({ to: "/home" }),
      () => undefined
    )
  }, [completed, signInRecovered, navigate])

  const run = async (action: () => Promise<Recovering>) => {
    setBusy(true)
    setProblem(undefined)
    await action().then(setRecovering, (error) => setProblem(recoverProblem(error)))
    setBusy(false)
  }

  return (
    <OnboardingFrame>
      {recovering === undefined || step === undefined ?
        (
          <>
            <Illustration name="passkey" size={56} />
            <OnboardingTitle title="Recover your account">
              Lost every passkey? Use your recovery key: the passkey you set up on another device or a hardware key.
            </OnboardingTitle>
          </>
        ) :
        <Outcome tone={step.tone} size="page" title={step.title} description={step.description} />}

      {problem === undefined ? null : (
        <Alert variant="warning" className="w-full text-left">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}

      <div className="mt-2.5 grid w-full gap-2.5">
        {recovering === undefined ?
          (
            <Button size="lg" className="w-full" loading={busy} onClick={() => void run(signIn)}>
              <Icon name="key" size={18} />Use my recovery key
            </Button>
          ) :
          step?.offer === "ask" ?
          (
            <Button size="lg" className="w-full" loading={busy} onClick={() => void run(request)}>
              <Icon name="face-id" size={18} />Make a passkey and ask
            </Button>
          ) :
          step?.offer === "make" ?
          (
            <Button size="lg" className="w-full" loading={busy} onClick={() => void run(execute)}>
              <Icon name="key" size={18} />Recover my account
            </Button>
          ) :
          step?.offer === "signIn" ?
          <PasskeySignIn variant="primary" label="Sign in with your new passkey" /> :
          null}
        <Button size="lg" variant="ghost" className="w-full" onClick={() => navigate({ to: "/" })}>
          Back to sign in
        </Button>
      </div>
    </OnboardingFrame>
  )
}
