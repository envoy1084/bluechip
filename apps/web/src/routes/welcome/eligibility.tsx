import type { Eligibility as SavedEligibility } from "@bluechip/domain/Account"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { RadioCard, RadioCardContent, RadioCardIcon, RadioGroup } from "@bluechip/ui/components/radio-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { accountReactivityKey, setEligibilityAtom } from "../../atoms/account.ts"
import { OnboardingFrame, OnboardingTitle } from "../../components/layout/OnboardingFrame.tsx"
import { SignedIn } from "../../components/SignedIn.tsx"

export const Route = createFileRoute("/welcome/eligibility")({ ssr: false, component: Eligibility })

type Answer = "outsideUs" | "us"

function Eligibility() {
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
  const choose = (value: Answer) => {
    setAnswer(value)
    if (value === "us") void setEligibility({ payload: { answer: "us" } })
  }
  const confirm = async () => {
    setSaving(true)
    await setEligibility({ payload: { answer: "outsideUs" }, reactivityKeys: [accountReactivityKey] })
      .finally(() => setSaving(false))
    await navigate({ to: "/welcome/cash" })
  }
  return (
    <OnboardingFrame step="Eligibility">
      <div className="grid w-full gap-3.5 text-left">
        <OnboardingTitle title="Where do you live?">
          Tokenized US stocks can't be offered to people in the United States, so bluechip can't be either. We ask once,
          here.
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
              <strong>Outside the United States</strong>I'm not a US citizen or resident
            </RadioCardContent>
          </RadioCard>
          <RadioCard value="us" className="items-center">
            <RadioCardIcon>
              <Icon name="flag" size={18} />
            </RadioCardIcon>
            <RadioCardContent>
              <strong>In the United States</strong>Or I'm a US citizen living abroad
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
        <Button size="lg" className="w-full" disabled={answer === "us"} loading={saving} onClick={confirm}>
          Continue<Icon name="arrow-right" size={16} />
        </Button>
      </div>
    </OnboardingFrame>
  )
}
