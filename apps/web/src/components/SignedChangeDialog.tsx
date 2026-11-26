import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@bluechip/ui/components/dialog"
import { type ReactNode, useState } from "react"

/** Where a change sent with Face ID stands once Base has had it: still on its way, taken, or refused. */
export type Landing = "pending" | "landed" | "failed"

/** The words of each step of a change: asking, on its way, through, and not through. */
export interface ChangeWords {
  readonly title: string
  readonly description: ReactNode
  readonly action: string
  readonly pending: string
  readonly done: string
  readonly doneDescription: string
  readonly failed: string
}

/**
 * A change of the account's owners or recovery signed with Face ID, in a dialog: what it does and the Face ID
 * button, then the Outcome while Base takes it and once it did (`landing`, from the live data the parent reads).
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
  const [problem, setProblem] = useState<string | undefined>(undefined)
  const close = () => {
    setSent(false)
    setProblem(undefined)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{words.title}</DialogTitle>
          <DialogDescription>{words.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid content-start gap-4">
          {!sent ?
            (
              <>
                {problem === undefined ? null : (
                  <Alert variant="destructive">
                    <AlertDescription>{problem}</AlertDescription>
                  </Alert>
                )}
                <PasskeyButton
                  size="lg"
                  className="w-full"
                  doneLabel="Sent"
                  onAuthenticate={async () => {
                    setProblem(undefined)
                    try {
                      await send()
                      setSent(true)
                    } catch (error) {
                      setProblem(error instanceof Error ? error.message : "Face ID was cancelled. Nothing changed.")
                      throw error
                    }
                  }}
                >
                  {words.action}
                </PasskeyButton>
              </>
            ) :
            (
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
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
