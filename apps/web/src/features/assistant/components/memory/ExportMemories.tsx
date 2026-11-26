import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { exportMemoriesAtom } from "../../atoms/assistant.ts"
import { exportFileName } from "../../model/memoryText.ts"

const PROBLEM = "We couldn't reach bluechip just now, so nothing was downloaded. Try again."

/** Downloads everything the assistant remembers as a JSON file. */
export function ExportMemories() {
  const exportMemories = useAtomSet(exportMemoriesAtom, { mode: "promise" })
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const download = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const { exportedAt, json } = await exportMemories()
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
      const link = document.createElement("a")
      link.href = url
      link.download = exportFileName(exportedAt)
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setProblem(PROBLEM)
    }
    setBusy(false)
  }

  return (
    <div className="grid gap-2">
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void download()}>
        <Icon name="download" size={14} />Export
      </Button>
      {problem === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
