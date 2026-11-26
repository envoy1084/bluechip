import { usdcTransferRequest } from "@bluechip/chain/funding/PaymentRequest"
import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useNavigate } from "@tanstack/react-router"
import { OnboardingFrame, OnboardingTitle } from "../../../components/layout/OnboardingFrame.tsx"
import { SignedIn } from "../../../components/SignedIn.tsx"
import { network } from "../../../lib/wallet.ts"

/** Sign-up's last step: the account's address to send USDC to, or skip to home. Nothing here watches for the deposit. */
export function DepositScreen() {
  const navigate = useNavigate()

  return (
    <SignedIn>
      {(me) => (
        <OnboardingFrame step="Deposit" wide>
          <div className="grid w-full gap-3.5 text-left">
            <OnboardingTitle title="Deposit cash">
              Send USDC on Base to this address. It appears in your balance once it arrives.
            </OnboardingTitle>
            <DepositCard
              address={me.account.address}
              paymentRequest={usdcTransferRequest({
                network,
                recipient: me.account.address as `0x${string}`
              })}
            />
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
