import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useNavigate } from "@tanstack/react-router"
import { OnboardingFrame, OnboardingTitle } from "../../../components/layout/OnboardingFrame.tsx"
import { SignedIn } from "../../../components/SignedIn.tsx"
import { chainName, usdcName } from "../../../lib/network.ts"
import { AddCashPanel } from "../components/AddCashPanel.tsx"

/**
 * Sign-up's last step: Add cash, as the app's own dialog shows it (the account's address and QR code, and the moment
 * cash arrives), then one way on to home, whether or not cash came yet.
 */
export function DepositScreen() {
  const navigate = useNavigate()

  return (
    <SignedIn>
      {(me) => (
        <OnboardingFrame step="Add cash" wide>
          <div className="grid w-full gap-3.5 text-left">
            <OnboardingTitle title="Add cash">
              Send {usdcName} on {chainName}{" "}
              to this address. It shows up here as soon as it lands, or add it later from home.
            </OnboardingTitle>
            <AddCashPanel address={me.account.address as `0x${string}`} />
            <Button size="lg" className="justify-self-end" onClick={() => navigate({ to: "/home" })}>
              Go to home<Icon name="arrow-right" size={16} />
            </Button>
          </div>
        </OnboardingFrame>
      )}
    </SignedIn>
  )
}
