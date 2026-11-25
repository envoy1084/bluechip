import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SignedIn } from "../../auth/SignedIn.tsx"
import { OnboardingFrame, OnboardingTitle } from "../../components/layout/OnboardingFrame.tsx"
import { AddCashPanel } from "../../funding/AddCashPanel.tsx"

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
            <AddCashPanel address={me.account.address as `0x${string}`} />
            <div className="flex flex-wrap justify-between gap-2.5">
              <Button variant="ghost" onClick={() => navigate({ to: "/home" })}>Skip for now</Button>
              <Button onClick={() => navigate({ to: "/home" })}>
                Go to home<Icon name="arrow-right" size={16} />
              </Button>
            </div>
          </div>
        </OnboardingFrame>
      )}
    </SignedIn>
  )
}
