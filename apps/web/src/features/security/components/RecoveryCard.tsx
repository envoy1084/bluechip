import { RequestId } from "@bluechip/domain/Ids"
import type { AccountRecovery } from "@bluechip/domain/recovery/Recovery"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { accountRecoveryAtom, cancelRecoveryAtom } from "../../../atoms/recovery.ts"
import { SettingsRow, SettingsSection } from "../../../components/layout/SettingsSection.tsx"
import { type Landing, SignedChangeDialog } from "../../../components/SignedChangeDialog.tsx"
import { securityReactivityKey } from "../../../lib/api/client.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { removeRecoveryKeyAtom, setUpRecoveryAtom } from "../atoms/security.ts"
import { changeProblem, recoveryText } from "../model/securityText.ts"

type Action = "setup" | "remove"

// A recovery key set up is in force once active (gone if Base refused it); a removed one once it's gone.
const landingOf = (action: Action, sent: boolean, recovery: AccountRecovery | undefined): Landing | undefined => {
  if (!sent || recovery === undefined) return undefined
  const status = recovery.key?.status
  if (action === "setup") return status === "active" ? "landed" : status === undefined ? "failed" : "pending"
  return status === undefined ? "landed" : status === "active" ? "failed" : "pending"
}

/**
 * The recovery passkey: set it up on another device or a hardware key, or remove it, with Face ID. A recovery asked
 * for shows here with Cancel, which needs no Face ID.
 */
export function RecoveryCard() {
  const recovery = useAtomValue(accountRecoveryAtom)
  const setUp = useAtomSet(setUpRecoveryAtom, { mode: "promise" })
  const remove = useAtomSet(removeRecoveryKeyAtom, { mode: "promise" })
  const cancel = useAtomSet(cancelRecoveryAtom, { mode: "promise" })
  const [action, setAction] = useState<Action | undefined>(undefined)
  const [sent, setSent] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelProblem, setCancelProblem] = useState<string | undefined>(undefined)

  if (!AsyncResult.isSuccess(recovery)) return null
  const text = recoveryText(recovery.value, localTimeZone())
  const key = recovery.value.key

  const send = async () => {
    try {
      const requestId = RequestId.make(crypto.randomUUID())
      await (action === "setup" ? setUp(requestId) : remove(requestId))
      setSent(true)
    } catch (error) {
      throw new Error(changeProblem(error), { cause: error })
    }
  }

  const cancelRecovery = async () => {
    setCancelling(true)
    setCancelProblem(undefined)
    await cancel({ reactivityKeys: [securityReactivityKey] }).catch((error) => setCancelProblem(changeProblem(error)))
    setCancelling(false)
  }

  return (
    <SettingsSection
      title="Recovery"
      description="A recovery key gets you back in if you lose every passkey, 48 hours after it asks."
    >
      {text.cancellable ?
        (
          <Alert variant="destructive" className="my-3.5">
            <AlertDescription className="grid gap-3">
              <span>
                <b className="block">{text.title}</b>
                {text.description}
              </span>
              {cancelProblem === undefined ? null : <span>{cancelProblem}</span>}
              <span>
                <Button variant="danger" size="sm" loading={cancelling} onClick={() => void cancelRecovery()}>
                  <Icon name="stop" size={14} />Cancel recovery
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        ) :
        null}
      <SettingsRow
        icon="key"
        title={text.cancellable ? (key?.label ?? "Recovery key") : text.title}
        description={text.cancellable ? "Remove it if you didn't ask for this recovery." : text.description}
      >
        {key === null ?
          (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSent(false)
                setAction("setup")
              }}
            >
              <Icon name="plus" size={14} />Set up a recovery key
            </Button>
          ) :
          key.status === "active" ?
          (
            <Button
              variant="ghost"
              size="sm"
              className="text-loss"
              onClick={() => {
                setSent(false)
                setAction("remove")
              }}
            >
              Remove
            </Button>
          ) :
          null}
      </SettingsRow>

      <SignedChangeDialog
        open={action !== undefined}
        onClose={() => setAction(undefined)}
        send={send}
        landing={action === undefined ? undefined : landingOf(action, sent, recovery.value)}
        words={action === "remove" ?
          {
            title: "Remove your recovery key?",
            description: "Without it, losing every passkey means losing access to your account. A recovery under " +
              "way ends too.",
            action: "Remove with Face ID",
            pending: "Removing your recovery key",
            done: "Your recovery key is removed",
            doneDescription: "It can no longer recover your account.",
            failed: "Your recovery key wasn't removed"
          } :
          {
            title: "Set up a recovery key",
            description: "Make a passkey on another device (scan the code with your phone) or a hardware key, and " +
              "keep it somewhere safe. Then lock it with Face ID. It can only ask to replace your passkeys, and " +
              "the change waits 48 hours, so you can always cancel it.",
            action: "Make it and lock with Face ID",
            pending: "Locking your recovery key",
            done: "Your recovery key is ready",
            doneDescription: "Keep it apart from this device. Sign in at bluechip's recovery page with it if you " +
              "ever lose every passkey.",
            failed: "Your recovery key wasn't set up"
          }}
      />
    </SettingsSection>
  )
}
