import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { Button } from "@bluechip/ui/components/button"
import type { IconName } from "@bluechip/ui/icons/icon"
import { type ReactNode, useState } from "react"
import { type PasskeyProblem, passkeyProblem } from "../lib/passkeyProblem.ts"
import { ConfirmDialog } from "./ConfirmDialog.tsx"

/** Where a change sent with Face ID stands once Base has had it: still on its way, taken, or refused. */
export type Landing = "pending" | "landed" | "failed"

/** The words of each step of a change: asking, on its way, through, and not through. */
interface ChangeWords {
  readonly title: string
  readonly description: ReactNode
  readonly action: string
  readonly pending: string
  readonly done: string
  readonly doneDescription: string
  readonly failed: string
  /** The dialog's icon; Face ID's by default. */
  readonly icon?: IconName
  /** The way to leave things as they are: "Keep it" by default. */
  readonly keep?: string
  /** Whether it takes something away (a passkey, the recovery key, the agents), so the dialog says so in red. */
  readonly danger?: boolean
}

/**
 * A change of the account's owners or recovery signed with Face ID, in a confirm dialog: what it does, Keep and the
 * Face ID button, then the Outcome while Base takes it and once it did (`landing`, from the live data the parent
 * reads). Cancelling Face ID isn't a problem: the dialog stays, saying nothing was sent.
 */
export function SignedChangeDialog(
  { landing, onClose, open, send, words }: Readonly<{
    open: boolean
    onClose: () => void
    words: ChangeWords
    /** Asks for Face ID and sends the change; rejects with the reason it didn't go. */
    send: () => Promise<void>
    landing: Landing | undefined
  }>
) {
  const [sent, setSent] = useState(false)
  const [problem, setProblem] = useState<PasskeyProblem | undefined>(undefined)
  const close = () => {
    setSent(false)
    setProblem(undefined)
    onClose()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      icon={words.icon ?? (words.danger === true ? "trash" : "face-id")}
      danger={words.danger === true}
      title={words.title}
      consequence={words.description}
      keepLabel={words.keep ?? "Keep it"}
      problem={problem}
      action={{
        _tag: "faceId",
        label: words.action,
        doneLabel: "Sent",
        onAuthenticate: async () => {
          setProblem(undefined)
          try {
            await send()
            setSent(true)
          } catch (error) {
            // A cancel reads the same everywhere; anything else, as the caller worded it.
            const failure = passkeyProblem(error, "Nothing changed.")
            setProblem(
              failure.cancelled || !(error instanceof Error) ? failure : { cancelled: false, text: error.message }
            )
            throw error
          }
        }
      }}
      outcome={!sent ? undefined : (
        <Outcome
          tone={landing === "landed" ? "success" : landing === "failed" ? "failure" : "pending"}
          size="card"
          title={landing === "landed" ? words.done : landing === "failed" ? words.failed : words.pending}
          description={landing === "landed" ?
            words.doneDescription :
            landing === "failed" ?
            "Base didn't take it, and nothing changed." :
            "Base takes it in a few seconds."}
          actions={landing === undefined || landing === "pending" ?
            undefined :
            <Button variant="secondary" onClick={close}>Done</Button>}
        />
      )}
    />
  )
}
