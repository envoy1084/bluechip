import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@bluechip/ui/components/alert-dialog"
import type { IconName } from "@bluechip/ui/icons/icon"
import type { ReactElement, ReactNode, RefObject } from "react"
import type { PasskeyProblem } from "../lib/passkeyProblem.ts"

/** What confirming does: a danger button that closes the dialog, or Face ID, which keeps it open while it works. */
type ConfirmAction =
  | { readonly _tag: "danger"; readonly label: string; readonly onConfirm: () => void }
  | {
    readonly _tag: "faceId"
    readonly label: string
    readonly doneLabel: string
    /** Asks for Face ID and does it; rejects when it didn't go (the dialog shows `problem`). */
    readonly onAuthenticate: () => Promise<void>
  }

/**
 * Asks before something that can't be undone: what it is, what follows, the way to keep things as they are (first, so
 * it takes focus, never the destructive button) and the action. `outcome` replaces the dialog's content once a Face
 * ID change is on its way. Opened by `trigger`, or controlled with `open`.
 */
export function ConfirmDialog(
  {
    open,
    onOpenChange,
    trigger,
    triggerLabel,
    icon = "trash",
    danger = true,
    title,
    consequence,
    keepLabel = "Keep it",
    action,
    problem,
    outcome,
    finalFocus
  }: Readonly<{
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** The button that opens it, as an element to render (`<Button variant="danger" />`), with `triggerLabel`. */
    trigger?: ReactElement
    triggerLabel?: ReactNode
    icon?: IconName
    /** Something that can't be undone, in red; `false` for a change that adds (a passkey, a recovery key). */
    danger?: boolean
    title: ReactNode
    consequence: ReactNode
    keepLabel?: string
    action: ConfirmAction
    /** Why the action didn't go; a cancelled Face ID reads as a quiet note, not an error. */
    problem?: PasskeyProblem | undefined
    outcome?: ReactNode
    /** Where focus goes once it closes, when it was opened without `trigger` (from a menu, say). */
    finalFocus?: RefObject<HTMLElement | null>
  }>
) {
  return (
    <AlertDialog
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange === undefined ? {} : { onOpenChange: (next: boolean) => onOpenChange(next) })}
    >
      {trigger === undefined ? null : <AlertDialogTrigger render={trigger}>{triggerLabel}</AlertDialogTrigger>}
      <AlertDialogContent {...(finalFocus === undefined ? {} : { finalFocus })}>
        {/* Once a Face ID change is on its way, its outcome is the whole dialog: what was asked no longer applies. */}
        {outcome ?? (
          <>
            <AlertDialogIcon
              name={icon}
              {...(danger ? {} : { className: "bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]" })}
            />
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{consequence}</AlertDialogDescription>
            </AlertDialogHeader>
            {problem === undefined ? null : problem.cancelled ?
              <output className="block text-label text-g-600">{problem.text}</output> :
              (
                <Alert variant="destructive">
                  <AlertDescription>{problem.text}</AlertDescription>
                </Alert>
              )}
            {/* One row: keep first, the action taking the rest, so its width holds while it works. */}
            <AlertDialogFooter className="flex-nowrap items-start max-[480px]:*:flex-none">
              <AlertDialogCancel className="shrink-0">{keepLabel}</AlertDialogCancel>
              {action._tag === "danger" ?
                (
                  <AlertDialogAction className="min-w-0 flex-1" onClick={action.onConfirm}>
                    {action.label}
                  </AlertDialogAction>
                ) :
                (
                  <PasskeyButton
                    className="min-w-0 flex-1"
                    doneLabel={action.doneLabel}
                    onAuthenticate={action.onAuthenticate}
                  >
                    {action.label}
                  </PasskeyButton>
                )}
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
