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
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { assistantReactivityKey, deleteMemoriesAtom } from "../../atoms/assistant.ts"

const reactivityKeys = [assistantReactivityKey]

const PROBLEM = "We couldn't reach bluechip just now. Nothing was deleted, so try again."

/**
 * Forgets everything at once: every memory, the conversations' summaries and what earlier conversations could recall.
 */
export function ForgetEverything() {
  const removeAll = useAtomSet(deleteMemoriesAtom, { mode: "promise" })
  const [problem, setProblem] = useState<string | null>(null)

  return (
    <div className="grid gap-2">
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" size="sm" />}>
          <Icon name="trash" size={14} />Delete everything
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogIcon name="trash" />
          <AlertDialogHeader>
            <AlertDialogTitle>Delete everything bluechip remembers?</AlertDialogTitle>
            <AlertDialogDescription>
              It forgets every preference, rule, goal and fact, and stops recalling your earlier conversations. Your
              conversations, agents and money stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setProblem(null)
                removeAll({ reactivityKeys }).catch(() => setProblem(PROBLEM))
              }}
            >
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {problem === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
