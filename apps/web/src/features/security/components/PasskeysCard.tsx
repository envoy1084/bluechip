import type { Passkey } from "@bluechip/domain/Account"
import { type PasskeyId, RequestId } from "@bluechip/domain/Ids"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { SettingsRow, SettingsSection } from "../../../components/layout/SettingsSection.tsx"
import { type Landing, SignedChangeDialog } from "../../../components/SignedChangeDialog.tsx"
import { localTimeZone } from "../../../lib/localTime.ts"
import { addPasskeyAtom, passkeysAtom, removePasskeyAtom } from "../atoms/security.ts"
import { changeProblem, passkeyDescription } from "../model/securityText.ts"

type Change = { readonly action: "add" } | { readonly action: "remove"; readonly passkey: Passkey }

// Where the change stands, from the live list: an added passkey is in force once active (gone if Base refused it); a
// removed one once it's gone (active again if Base refused).
const landingOf = (
  sent: PasskeyId | undefined,
  change: Change,
  passkeys: ReadonlyArray<Passkey>
): Landing | undefined => {
  if (sent === undefined) return undefined
  const found = passkeys.find((passkey) => passkey.id === sent)
  if (change.action === "add") return found === undefined ? "failed" : found.status === "active" ? "landed" : "pending"
  return found === undefined ? "landed" : found.status === "active" ? "failed" : "pending"
}

/**
 * The passkeys that own the account: any one of them signs. Add one (this device, another by its QR code, or a
 * hardware key) or remove one with Face ID, never the last.
 */
export function PasskeysCard() {
  const passkeys = useAtomValue(passkeysAtom)
  const add = useAtomSet(addPasskeyAtom, { mode: "promise" })
  const remove = useAtomSet(removePasskeyAtom, { mode: "promise" })
  const [change, setChange] = useState<Change | undefined>(undefined)
  const [sent, setSent] = useState<PasskeyId | undefined>(undefined)

  const list = AsyncResult.isSuccess(passkeys) ? passkeys.value : []
  const owners = list.filter((passkey) => passkey.status === "active").length
  const timeZone = localTimeZone()

  const send = async () => {
    if (change === undefined) return
    try {
      const requestId = RequestId.make(crypto.randomUUID())
      const passkey = change.action === "add" ?
        await add(requestId) :
        await remove({ id: change.passkey.id, requestId })
      setSent(passkey.id)
    } catch (error) {
      throw new Error(changeProblem(error), { cause: error })
    }
  }

  return (
    <SettingsSection
      title="Passkeys"
      illustration="passkey"
      description="Each passkey signs in and approves with Face ID or a fingerprint. Any one of them is enough."
    >
      {list.map((passkey) => (
        <SettingsRow
          key={passkey.id}
          icon="face-id"
          title={
            <>
              {passkey.label ?? "Passkey"}
              {passkey.current ?
                (
                  <span className="rounded-full bg-g-100 px-2 py-0.5 text-[11.5px] font-semibold text-g-600">
                    This device
                  </span>
                ) :
                null}
            </>
          }
          description={passkeyDescription(passkey, timeZone)}
        >
          {passkey.status === "active" && owners > 1 ?
            (
              <Button
                variant="ghost"
                size="sm"
                className="text-loss"
                onClick={() => {
                  setSent(undefined)
                  setChange({ action: "remove", passkey })
                }}
              >
                Remove
              </Button>
            ) :
            null}
        </SettingsRow>
      ))}
      <SettingsRow
        title="Add a passkey"
        description={owners === 1 ?
          "You have one passkey. Add another so losing this device never locks you out." :
          "On this device, another one by scanning its code, or a hardware key."}
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setSent(undefined)
            setChange({ action: "add" })
          }}
        >
          <Icon name="plus" size={14} />Add a passkey
        </Button>
      </SettingsRow>

      <SignedChangeDialog
        open={change !== undefined}
        onClose={() => setChange(undefined)}
        send={send}
        landing={change === undefined ? undefined : landingOf(sent, change, list)}
        words={change?.action === "remove" ?
          {
            title: `Remove ${change.passkey.label ?? "this passkey"}?`,
            description: "It can no longer sign in or approve anything, and devices signed in with it are signed out.",
            action: "Remove with Face ID",
            pending: "Removing the passkey",
            done: "The passkey is removed",
            doneDescription: "It no longer signs for your account.",
            failed: "The passkey wasn't removed"
          } :
          {
            title: "Add a passkey",
            description: "First make the new passkey: on this device, on another by scanning its code, or on a " +
              "hardware key. Then approve it with one of your passkeys.",
            action: "Make it and approve with Face ID",
            pending: "Adding the passkey",
            done: "The passkey is added",
            doneDescription: "It signs in and approves like your other passkeys.",
            failed: "The passkey wasn't added"
          }}
      />
    </SettingsSection>
  )
}
