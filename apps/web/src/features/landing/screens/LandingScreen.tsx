import { buttonVariants } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { Link } from "@tanstack/react-router"
import { OnboardingFrame, OnboardingTitle } from "../../../components/layout/OnboardingFrame.tsx"
import { PasskeySignIn } from "../../../components/PasskeySignIn.tsx"
import { SignedInRedirect } from "../../../components/SignedInRedirect.tsx"

/**
 * Where people arrive: what bluechip is, Create an account, and Sign in with passkey right here. Someone already
 * signed in goes on to home. Create an account is a link, so it works before the page hydrates.
 */
export function LandingScreen() {
  return (
    <OnboardingFrame>
      <SignedInRedirect />
      <div className="-mb-1.5 size-[210px]">
        <Halftone scene="logo" className="size-full" />
      </div>
      <OnboardingTitle title="You and your agents, trading stocks on Base">
        Hire an agent, set its limits onchain, and let it trade tokenized US stocks for you.
      </OnboardingTitle>
      <div className="mt-2.5 grid w-full gap-2.5">
        <Link to="/welcome" className={buttonVariants({ size: "lg", className: "w-full" })}>
          Create an account<Icon name="arrow-right" size={16} />
        </Link>
        <PasskeySignIn />
        <Link to="/recover" className={buttonVariants({ size: "lg", variant: "ghost", className: "w-full" })}>
          Lost your passkey? Recover your account
        </Link>
      </div>
    </OnboardingFrame>
  )
}
