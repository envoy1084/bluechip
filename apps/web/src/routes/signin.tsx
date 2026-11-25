import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { signInAtom } from "../atoms/account.ts"
import { OnboardingFrame } from "../shell/OnboardingFrame.tsx"

export const Route = createFileRoute("/signin")({ ssr: false, component: SignIn })

function SignIn() {
  const signIn = useAtomSet(signInAtom, { mode: "promise" })
  const navigate = useNavigate()
  return (
    <OnboardingFrame scene="logo">
      <div className="grid gap-3">
        <h1 className="text-display-3 font-semibold tracking-tight">Welcome back</h1>
        <p className="text-body text-g-600">Sign in with the passkey you created your account with.</p>
      </div>
      <PasskeyButton
        doneLabel="Signed in"
        onAuthenticate={async () => {
          const me = await signIn()
          await navigate({ to: me.user.eligibility === "unknown" ? "/welcome/eligibility" : "/home" })
        }}
      >
        Sign in with Face ID
      </PasskeyButton>
      <p className="text-body-sm text-g-600">
        New to bluechip? <Link to="/welcome" className="font-medium text-blue">Create an account</Link>
      </p>
    </OnboardingFrame>
  )
}
