import { Button } from "@bluechip/ui/components/button"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { setEligibilityAtom } from "../../atoms/account.ts"
import { SignedIn } from "../../auth/SignedIn.tsx"
import { OnboardingFrame } from "../../shell/OnboardingFrame.tsx"

export const Route = createFileRoute("/welcome/eligibility")({ ssr: false, component: Eligibility })

function Eligibility() {
  const setEligibility = useAtomSet(setEligibilityAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [pending, setPending] = useState<"outsideUs" | "us" | null>(null)
  const answer = async (value: "outsideUs" | "us") => {
    setPending(value)
    await setEligibility({ payload: { answer: value }, reactivityKeys: ["account"] }).finally(() => setPending(null))
    await navigate({ to: "/welcome/ready" })
  }
  return (
    <SignedIn>
      {() => (
        <OnboardingFrame scene="market" step="Step 2 of 3">
          <div className="grid gap-3">
            <h1 className="text-display-3 font-semibold tracking-tight">Where are you based?</h1>
            <p className="text-body text-g-600">
              Tokenized stocks on Base are offered to people outside the United States only. You can still explore
              bluechip either way.
            </p>
          </div>
          <div className="grid gap-3">
            <Button size="lg" loading={pending === "outsideUs"} onClick={() => answer("outsideUs")}>
              I'm not a US person
            </Button>
            <Button size="lg" variant="secondary" loading={pending === "us"} onClick={() => answer("us")}>
              I'm a US person
            </Button>
          </div>
        </OnboardingFrame>
      )}
    </SignedIn>
  )
}
