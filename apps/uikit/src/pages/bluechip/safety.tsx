import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Checkbox } from "@bluechip/ui/components/checkbox"
import { Label } from "@bluechip/ui/components/label"
import { useId, useState } from "react"
import { Section } from "./layout.tsx"
import { wait } from "./market.ts"

/* ---------- Account & safety ---------- */

export function PasskeySection() {
  const [failNext, setFailNext] = useState(false)
  const failId = useId()
  const faceId = async () => {
    await wait(1100)
    if (failNext) throw new Error("Face ID failed")
  }
  return (
    <Section
      id="passkey"
      title="Passkey button"
      purpose="The one button for anything that needs you: creating your account, signing in, approving a trade, locking limits. It always names Face ID and shows what's happening."
      notes={[
        "Primary, 46 px, Face ID glyph",
        "Waiting → done (seal) → back after 1.5 s",
        "Error says to try again; never a code"
      ]}
      states={[
        [
          "Sign in",
          <PasskeyButton key="s" variant="secondary" doneLabel="Signed in" onAuthenticate={() => wait(900)}>
            Sign in with Face ID
          </PasskeyButton>
        ],
        [
          "Fingerprint",
          <PasskeyButton key="f" method="fingerprint" doneLabel="Approved" onAuthenticate={() => wait(900)}>
            Approve with fingerprint
          </PasskeyButton>
        ],
        [
          "Always fails",
          <PasskeyButton
            key="e"
            doneLabel="Signed in"
            onAuthenticate={() => wait(700).then(() => Promise.reject(new Error("cancelled")))}
          >
            Sign in with Face ID
          </PasskeyButton>
        ],
        [
          "Disabled",
          <PasskeyButton key="d" disabled doneLabel="Approved" onAuthenticate={() => Promise.resolve()}>
            Approve with Face ID
          </PasskeyButton>
        ]
      ]}
    >
      <div className="grid w-full max-w-[420px] justify-items-center gap-3 text-center">
        <PasskeyButton size="lg" className="w-full" doneLabel="Account created" onAuthenticate={faceId}>
          Create account with Face ID
        </PasskeyButton>
        <Label htmlFor={failId} className="flex cursor-pointer items-center gap-2 font-normal text-g-600">
          <Checkbox id={failId} checked={failNext} onCheckedChange={setFailNext} />
          Make Face ID fail
        </Label>
        <p className="text-label-sm text-g-500">
          No password and no seed phrase. Your account lives on Base, and only your face or fingerprint can move money.
        </p>
      </div>
    </Section>
  )
}
