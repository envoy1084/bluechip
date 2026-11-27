import type { Eligibility as SavedEligibility } from "@bluechip/domain/Account"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { RadioCard, RadioCardContent, RadioCardIcon, RadioGroup } from "@bluechip/ui/components/radio-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { OnboardingFrame, OnboardingTitle } from "../../../components/layout/OnboardingFrame.tsx"
import { SignedIn } from "../../../components/SignedIn.tsx"
import { resetAnalytics, track } from "../../../lib/analytics.ts"
import { accountReactivityKey } from "../../../lib/api/client.ts"
import { setEligibilityAtom, signOutAtom } from "../atoms/auth.ts"

type Answer = "outsideUs" | "us"

export function EligibilityScreen() {
  return <SignedIn>{(me) => <EligibilityForm saved={me.user.eligibility} />}</SignedIn>
}

/**
 * Starts from the saved answer, so a US person who signs in again sees why they can't continue. A US answer is saved
 * as soon as it's picked; the other is saved with Continue.
 */
function EligibilityForm({ saved }: Readonly<{ saved: SavedEligibility }>) {
  const setEligibility = useAtomSet(setEligibilityAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [answer, setAnswer] = useState<Answer>(saved === "us" ? "us" : "outsideUs")
  const [saving, setSaving] = useState(false)
  const signOut = useAtomSet(signOutAtom, { mode: "promise" })
  const [signingOut, setSigningOut] = useState(false)
  const choose = (value: Answer) => {
    setAnswer(value)
    if (value === "us") void setEligibility({ payload: { answer: "us" } })
  }
  const confirm = async () => {
    setSaving(true)
    await setEligibility({ payload: { answer: "outsideUs" }, reactivityKeys: [accountReactivityKey] })
      .finally(() => setSaving(false))
    await navigate({ to: "/welcome/deposit" })
  }
  return (
    <OnboardingFrame step="Eligibility">
      <div className="grid w-full gap-3.5 text-left">
        <OnboardingTitle title="Are you a US citizen or resident?">
          Tokenized US stocks can't be offered to US citizens or residents, so bluechip isn't available to them.
        </OnboardingTitle>
        <RadioGroup
          aria-label="Where you live"
          value={answer}
          onValueChange={(value) => choose(value as Answer)}
          className="gap-2.5"
        >
          <RadioCard value="outsideUs" className="items-center">
            <RadioCardIcon>
              <Icon name="globe" size={18} />
            </RadioCardIcon>
            <RadioCardContent>
              <strong>Outside the United States</strong>I'm neither a US citizen nor a US resident
            </RadioCardContent>
          </RadioCard>
          <RadioCard value="us" className="items-center">
            <RadioCardIcon>
              <Icon name="flag" size={18} />
            </RadioCardIcon>
            <RadioCardContent>
              <strong>In the United States</strong>I live in the US, or I'm a US citizen anywhere
            </RadioCardContent>
          </RadioCard>
        </RadioGroup>
        {answer === "us" ?
          (
            <Alert variant="warning">
              <AlertTitle>bluechip isn't available in the US</AlertTitle>
              <AlertDescription>
                We can't open an account for you. No money was moved, and you can delete the passkey from your device
                settings.
              </AlertDescription>
            </Alert>
          ) :
          (
            <p className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-gain">
              <Icon name="check-circle" size={14} />You can use bluechip.
            </p>
          )}
        {answer === "us" ?
          (
            // No way on, but a way out: sign out, and the landing page.
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              loading={signingOut}
              onClick={async () => {
                setSigningOut(true)
                await signOut({ reactivityKeys: [accountReactivityKey] }).finally(() => setSigningOut(false))
                track({ _tag: "signed_out", scope: "this" })
                resetAnalytics()
                await navigate({ to: "/" })
              }}
            >
              <Icon name="logout" size={16} />Sign out
            </Button>
          ) :
          (
            <Button size="lg" className="w-full" loading={saving} onClick={confirm}>
              Continue<Icon name="arrow-right" size={16} />
            </Button>
          )}
      </div>
    </OnboardingFrame>
  )
}
