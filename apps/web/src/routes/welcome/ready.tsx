import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { Button } from "@bluechip/ui/components/button"
import { Seal } from "@bluechip/ui/motion/seal"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SignedIn } from "../../auth/SignedIn.tsx"
import { OnboardingFrame } from "../../shell/OnboardingFrame.tsx"

export const Route = createFileRoute("/welcome/ready")({ ssr: false, component: Ready })

function Ready() {
  const navigate = useNavigate()
  return (
    <SignedIn>
      {(me) => (
        <OnboardingFrame scene="garden" step="Step 3 of 3">
          <Seal playing className="size-24" label="Account secured with your passkey" />
          <div className="grid gap-3">
            <h1 className="text-display-3 font-semibold tracking-tight">Your account is ready</h1>
            <p className="text-body text-g-600">
              This is your account on Base. Only your passkey can move money out of it, and your agents can only do what
              you allow.
            </p>
          </div>
          <AddressChip address={me.account.address} className="justify-self-start" />
          <Button size="lg" onClick={() => navigate({ to: "/home" })}>Go to bluechip</Button>
        </OnboardingFrame>
      )}
    </SignedIn>
  )
}
