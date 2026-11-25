import type { Memory } from "@bluechip/domain/assistant/Memory"
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
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDate } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { localTimeZone } from "../../../lib/localTime.ts"
import {
  assistantReactivityKey,
  confirmMemoryAtom,
  deleteMemoriesAtom,
  deleteMemoryAtom,
  memoriesAtom
} from "../atoms/assistant.ts"
import { MEMORY_KIND } from "../model/cardText.ts"

const reactivityKeys = [assistantReactivityKey]

const PROBLEM = "We couldn't reach bluechip just now. Nothing was deleted, so try again."

const CONFIRM_PROBLEM = "We couldn't reach bluechip just now. It isn't confirmed yet, so try again."

/** Where a memory came from, in words: "You said it", "Inferred, 72% sure", and whether it's in use. */
const provenance = (memory: Memory): string => {
  const from = memory.source === "said" ? "You said it" : `Inferred, ${Math.round(memory.confidence * 100)}% sure`
  const on = formatDate(DateTime.toDateUtc(memory.createdAt), { timeZone: localTimeZone() })
  return `${from}, on ${on}`
}

function MemoryRow({ memory, agentName }: Readonly<{ memory: Memory; agentName: string | undefined }>) {
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
          <span className="text-label-sm text-g-500">{provenance(memory)}</span>
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

function DeleteAll() {
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
              It forgets every preference, rule, goal and fact. Your conversations, agents and money stay as they are.
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

/** What the assistant remembers about you, where each memory came from, and the way to delete one or all of them. */
export function MemoryScreen() {
  const memories = useAtomValue(memoriesAtom)
  const refresh = useAtomRefresh(memoriesAtom)
  const agents = useAtomValue(agentsAtom)
  const agentName = (memory: Memory) =>
    memory.agentId === null || !AsyncResult.isSuccess(agents) ?
      undefined :
      agents.value.find((agent) => agent.id === memory.agentId)?.name

  return (
    <AppPage title="Memory" sub="What bluechip remembers about you">
      <section className="rounded-lg bg-white px-[22px] pt-0.5 pb-1 shadow-e2">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-g-100 pt-[18px] pb-3.5">
          <div className="grid gap-1">
            <h3 className="text-base font-semibold tracking-[-0.02em]">Memories</h3>
            <p className="text-[13.5px] text-g-600">
              The assistant uses these to answer you. It keeps what you tell it, and asks before keeping what it infers.
            </p>
          </div>
          {AsyncResult.isSuccess(memories) && memories.value.length > 0 ? <DeleteAll /> : null}
        </div>

        {AsyncResult.isInitial(memories) ?
          (
            <div aria-busy className="grid gap-3 py-4">
              {[0, 1, 2].map((row) => <SkeletonBlock key={row} className="h-14 w-full rounded-md" />)}
            </div>
          ) :
          !AsyncResult.isSuccess(memories) ?
          (
            <div className="grid justify-items-center gap-3 py-10 text-center">
              <p className="text-body-sm text-g-600">
                We couldn't load your memories. Check your connection and try again.
              </p>
              <Button variant="secondary" onClick={refresh}>Try again</Button>
            </div>
          ) :
          memories.value.length === 0 ?
          (
            <p className="py-10 text-center text-body-sm text-g-600">
              Nothing yet. Tell the assistant what matters to you, like "I never want to own Tesla", and it remembers.
            </p>
          ) :
          (
            <ul>
              {memories.value.map((memory) => (
                <MemoryRow key={memory.id} memory={memory} agentName={agentName(memory)} />
              ))}
            </ul>
          )}
      </section>
    </AppPage>
  )
}
