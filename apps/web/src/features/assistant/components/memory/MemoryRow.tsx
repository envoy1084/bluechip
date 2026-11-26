import type { Memory } from "@bluechip/domain/assistant/Memory"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { assistantReactivityKey, confirmMemoryAtom, deleteMemoryAtom } from "../../atoms/assistant.ts"
import { MEMORY_KIND } from "../../model/cardText.ts"
import { provenance, usage } from "../../model/memoryText.ts"

const reactivityKeys = [assistantReactivityKey]

const PROBLEM = "We couldn't reach bluechip just now. Nothing was deleted, so try again."

const CONFIRM_PROBLEM = "We couldn't reach bluechip just now. It isn't confirmed yet, so try again."

/** One memory: what it is, where it came from, how often answers used it, and the way to confirm or delete it. */
export function MemoryRow({ memory, agentName }: Readonly<{ memory: Memory; agentName: string | undefined }>) {
  const remove = useAtomSet(deleteMemoryAtom, { mode: "promise" })
  const confirm = useAtomSet(confirmMemoryAtom, { mode: "promise" })
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Confirming also answers its card in the conversation; the list then shows it confirmed.
  const keep = async () => {
    setConfirming(true)
    setProblem(null)
    try {
      await confirm({ params: { id: memory.id }, reactivityKeys })
    } catch {
      setProblem(CONFIRM_PROBLEM)
    }
    setConfirming(false)
  }

  const forget = async () => {
    setBusy(true)
    setProblem(null)
    try {
      await remove({ params: { id: memory.id }, reactivityKeys })
    } catch {
      setProblem(PROBLEM)
      setBusy(false)
    }
  }

  return (
    <li className="grid gap-2 border-b border-g-100 py-3.5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold text-g-600">
            <span className="rounded-full bg-g-100 px-2 py-0.5">{MEMORY_KIND[memory.kind]}</span>
            {agentName === undefined
              ? null
              : <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue">{agentName}</span>}
            {memory.confirmedAt === null ?
              <span className="rounded-full bg-warn-wash px-2 py-0.5 text-warn">Not confirmed</span> :
              null}
          </span>
          <p className="text-[14.5px] text-ink">{memory.text}</p>
          <span className="text-label-sm text-g-500">{provenance(memory, localTimeZone())}</span>
          {memory.confirmedAt === null ? null : <span className="text-label-sm text-g-500">{usage(memory)}</span>}
          {memory.note === null ? null : <span className="text-label-sm text-g-500">{memory.note}</span>}
          {memory.confirmedAt === null ?
            (
              <span className="text-label-sm text-g-500">
                bluechip doesn't use it until you confirm it.
              </span>
            ) :
            null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {memory.confirmedAt === null ?
            (
              <Button variant="secondary" size="sm" loading={confirming} onClick={() => void keep()}>
                <Icon name="check" size={14} />Remember
              </Button>
            ) :
            null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete: ${memory.text}`}
            loading={busy}
            onClick={() => void forget()}
          >
            <Icon name="trash" size={16} />
          </Button>
        </div>
      </div>
      {problem === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </li>
  )
}
