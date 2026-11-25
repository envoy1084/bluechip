import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useNavigate } from "@tanstack/react-router"
import { OnboardingFrame, OnboardingTitle } from "../../../components/layout/OnboardingFrame.tsx"
import { SignedIn } from "../../../components/SignedIn.tsx"
import { AddCashPanel } from "../components/AddCashPanel.tsx"

/** Sign-up's last step: the account's address to send USDC to, or skip to home. */
export function AddCashScreen() {
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
