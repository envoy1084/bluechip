import type { Memory } from "@bluechip/domain/assistant/Memory"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { assistantReactivityKey, confirmMemoryAtom, deleteMemoryAtom } from "../../atoms/assistant.ts"
import { provenance, usage } from "../../model/memoryText.ts"

const reactivityKeys = [assistantReactivityKey]

const PROBLEM = "We couldn't reach bluechip just now. Nothing was deleted, so try again."

const CONFIRM_PROBLEM = "We couldn't reach bluechip just now. It isn't confirmed yet, so try again."

/**
 * One memory: its sentence, the agent it's about, where it came from and how answers used it. A guess offers
 * Remember and Not right; a kept memory is deleted from the button that shows on hover.
 */
export function MemoryRow(
  { memory, agentName, now }: Readonly<{ memory: Memory; agentName: string | undefined; now: Date }>
) {
  const remove = useAtomSet(deleteMemoryAtom, { mode: "promise" })
  const confirm = useAtomSet(confirmMemoryAtom, { mode: "promise" })
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const guess = memory.confirmedAt === null
  const timeZone = localTimeZone()

  // Confirming also answers its card in the conversation; the list then shows it with the kept ones.
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
    setDeleting(true)
    setProblem(null)
    try {
      await remove({ params: { id: memory.id }, reactivityKeys })
    } catch {
      setProblem(PROBLEM)
      setDeleting(false)
    }
  }

  return (
    <li className="group/memory grid gap-2.5 border-b border-g-100 px-5 py-3.5 last:border-b-0">
      <div className={cn("flex items-start justify-between gap-4", guess && "max-sm:flex-col max-sm:gap-2.5")}>
        <div className="grid min-w-0 gap-1.5">
          <p className="text-[14.5px] leading-snug text-ink text-pretty">{memory.text}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-g-500">
            {agentName === undefined || memory.agentId === null ?
              null :
              (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-0.5 pr-2 pl-0.5 font-semibold text-blue">
                  <AgentAvatar agentId={memory.agentId} size="sm" className="size-4 rounded-full [&_canvas]:w-3" />
                  {agentName}
                </span>
              )}
            <span>{provenance(memory, timeZone)}</span>
            {guess ? null : <span>{usage(memory, now, timeZone)}</span>}
          </div>
          {memory.note === null ? null : <span className="text-label-sm text-g-400 italic">{memory.note}</span>}
        </div>

        {guess ?
          (
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="secondary" size="sm" loading={confirming} onClick={() => void keep()}>
                <Icon name="check" size={14} />Remember
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={deleting}
                aria-label={`Not right: ${memory.text}`}
                onClick={() => void forget()}
              >
                Not right
              </Button>
            </div>
          ) :
          (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete: ${memory.text}`}
              loading={deleting}
              onClick={() => void forget()}
              className="shrink-0 text-g-400 hover:text-loss focus-visible:opacity-100 sm:opacity-0 sm:group-hover/memory:opacity-100 sm:group-focus-within/memory:opacity-100 sm:[@media(hover:none)]:opacity-100"
            >
              <Icon name="trash" size={16} />
            </Button>
          )}
      </div>
      {problem === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </li>
  )
}
