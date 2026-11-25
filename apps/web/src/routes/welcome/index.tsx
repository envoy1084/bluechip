import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Field, FieldDescription, FieldLabel } from "@bluechip/ui/components/field"
import { Input } from "@bluechip/ui/components/input"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { signUpAtom } from "../../atoms/account.ts"
import { OnboardingFrame } from "../../shell/OnboardingFrame.tsx"

export const Route = createFileRoute("/welcome/")({ ssr: false, component: Welcome })

function Welcome() {
  const signUp = useAtomSet(signUpAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [name, setName] = useState("")
  return (
    <OnboardingFrame scene="coin" step="Step 1 of 3">
      <div className="grid gap-3">
        <h1 className="text-display-3 font-semibold tracking-tight">Create your account</h1>
        <p className="text-body text-g-600">
          Your passkey is your login and the key to your account on Base. No password, no seed phrase.
        </p>
      </div>
      <Field>
        <FieldLabel>Your name</FieldLabel>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional" maxLength={64} />
        <FieldDescription>Shown on your passkey so you can tell it apart.</FieldDescription>
      </Field>
      <PasskeyButton
        doneLabel="Account created"
        onAuthenticate={async () => {
          await signUp(name.trim())
          await navigate({ to: "/welcome/eligibility" })
        }}
      >
        Create account with Face ID
      </PasskeyButton>
      <p className="text-body-sm text-g-600">
        Already have an account? <Link to="/signin" className="font-medium text-blue">Sign in</Link>
      </p>
    </OnboardingFrame>
  )
}
