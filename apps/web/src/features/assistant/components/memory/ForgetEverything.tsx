import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { ConfirmDialog } from "../../../../components/ConfirmDialog.tsx"
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
      <ConfirmDialog
        trigger={<Button variant="danger" size="sm" />}
        triggerLabel={
          <>
            <Icon name="trash" size={14} />Delete everything
          </>
        }
        title="Delete everything bluechip remembers?"
        consequence="It forgets every preference, rule, goal and fact, and stops recalling your earlier conversations. Your conversations, agents and money stay as they are."
        keepLabel="Keep them"
        action={{
          _tag: "danger",
          label: "Delete everything",
          onConfirm: () => {
            setProblem(null)
            removeAll({ reactivityKeys }).catch(() => setProblem(PROBLEM))
          }
        }}
      />
      {problem === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
