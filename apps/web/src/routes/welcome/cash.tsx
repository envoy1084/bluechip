import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { Button } from "@bluechip/ui/components/button"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SignedIn } from "../../auth/SignedIn.tsx"
import { OnboardingFrame, OnboardingTitle } from "../../shell/OnboardingFrame.tsx"

export const Route = createFileRoute("/welcome/cash")({ ssr: false, component: AddCash })

function AddCash() {
  const navigate = useNavigate()
  return (
    <SignedIn>
      {(me) => (
        <OnboardingFrame step="Cash" wide>
          <div className="grid w-full gap-3.5 text-left">
            <OnboardingTitle title="Add cash">
              Send USDC on Base to your bluechip account. It usually shows up in about a minute.
            </OnboardingTitle>
            <DepositCard address={me.account.address} status="waiting" />
            <div className="flex flex-wrap justify-between gap-2.5">
              <Button variant="ghost" onClick={() => navigate({ to: "/home" })}>Skip for now</Button>
            </div>
          </div>
        </OnboardingFrame>
      )}
    </SignedIn>
  )
}
