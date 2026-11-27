import { buttonVariants } from "@bluechip/ui/components/button"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { Link } from "@tanstack/react-router"
import { OnboardingFrame, OnboardingTitle } from "../../../components/layout/OnboardingFrame.tsx"
import { PasskeySignIn } from "../../../components/PasskeySignIn.tsx"
import { SignedInRedirect } from "../../../components/SignedInRedirect.tsx"

/** Sign in with the passkey on this device; someone already signed in goes on to home. */
export function SignInScreen() {
  return (
    <OnboardingFrame>
      <SignedInRedirect />
      <div className="-mb-1.5 size-[180px]">
        <Halftone scene="logo" className="size-full" />
      </div>
      <OnboardingTitle title="Welcome back">
        Sign in with the passkey you made for bluechip. Face ID or your device's lock unlocks it.
      </OnboardingTitle>
      <div className="mt-2.5 grid w-full gap-2.5">
        <PasskeySignIn variant="primary" />
        <Link to="/welcome" className={buttonVariants({ size: "lg", variant: "secondary", className: "w-full" })}>
          Create an account
        </Link>
        <Link to="/recover" className={buttonVariants({ size: "lg", variant: "ghost", className: "w-full" })}>
          Lost your passkey? Recover your account
        </Link>
      </div>
    </OnboardingFrame>
  )
}
