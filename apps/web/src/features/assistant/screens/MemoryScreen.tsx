import type { Memory, MemoryKind } from "@bluechip/domain/assistant/Memory"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { InputGroup, InputGroupButton, InputGroupInput } from "@bluechip/ui/components/input-group"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type ReactNode, useEffect, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { FilterTabs } from "../../../components/FilterTabs.tsx"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { memoriesAtom } from "../atoms/assistant.ts"
import { ExportMemories } from "../components/memory/ExportMemories.tsx"
import { ForgetEverything } from "../components/memory/ForgetEverything.tsx"
import { MemoryGroup } from "../components/memory/MemoryGroup.tsx"
import { MemoryRow } from "../components/memory/MemoryRow.tsx"
import { MEMORY_KIND } from "../model/cardText.ts"
import { groupMemories, matchesMemory, MEMORY_GROUPS } from "../model/memoryText.ts"

// The search asks bluechip (by words and meaning) once typing has settled for this long; until then, what's typed
// filters the list by its words.
const SEARCH_SETTLE_MS = 250

function MemoriesSkeleton() {
  return (
    <div aria-busy className="overflow-hidden rounded-lg bg-white shadow-e2">
      {[0, 1, 2].map((row) => (
        <div key={row} className="grid gap-2 border-b border-g-100 px-5 py-4 last:border-b-0">
          <SkeletonBlock className="h-4 w-3/5" />
          <SkeletonBlock className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  )
}

function MemoriesEmpty(
  { title, description, action }: Readonly<{ title: string; description: string; action: ReactNode }>
) {
  return (
    <IllustratedEmpty illustration="notebook" size={110} compact title={title} action={action}>
      {description}
    </IllustratedEmpty>
  )
}

/**
 * What the assistant remembers about you: the guesses waiting for you on top, then what it uses by kind, each with
 * where it came from and how often answers used it; searchable, filtered by kind, to export, and to delete one or all
 * of.
 */
export function MemoryScreen() {
  const all = useAtomValue(memoriesAtom(""))
  const refresh = useAtomRefresh(memoriesAtom(""))
  const agents = useAtomValue(agentsAtom)
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<MemoryKind | "all">("all")
  const [now] = useState(() => new Date())
  const typed = query.trim()
  const recalled = useAtomValue(memoriesAtom(search))

  useEffect(() => {
    const settle = setTimeout(() => setSearch(query.trim()), SEARCH_SETTLE_MS)
    return () => clearTimeout(settle)
  }, [query])

  const agentName = (memory: Memory) =>
    memory.agentId === null || !AsyncResult.isSuccess(agents) ?
      undefined :
      agents.value.find((agent) => agent.id === memory.agentId)?.name

  const body = () => {
    if (AsyncResult.isInitial(all)) return <MemoriesSkeleton />
    if (!AsyncResult.isSuccess(all)) {
      return <LoadProblem what="your memories" onRetry={refresh} variant="card" />
    }
    if (all.value.length === 0) {
      return (
        <MemoriesEmpty
          title="Nothing remembered yet"
          description="Tell the assistant what matters to you, like “I never want to own Tesla”, and it remembers."
          action={
            <ButtonLink
              variant="secondary"
              size="sm"
              render={<Link to="/chat/{-$conversationId}" params={{ conversationId: undefined }} />}
            >
              <Icon name="chat" size={14} />Talk to the assistant
            </ButtonLink>
          }
        />
      )
    }

    // What the search recalled once it settles on what's typed; until then, the memories with its words.
    const found = typed === "" ?
      all.value :
      search === typed && AsyncResult.isSuccess(recalled) ?
      recalled.value :
      all.value.filter((memory) =>
        matchesMemory([memory.text, MEMORY_KIND[memory.kind], agentName(memory) ?? ""], typed)
      )
    if (found.length === 0) {
      return (
        <MemoriesEmpty
          title={`No memory matches “${typed}”.`}
          description="Try other words: the search looks for what a memory says and what it means."
          action={<Button variant="secondary" size="sm" onClick={() => setQuery("")}>Clear the search</Button>}
        />
      )
    }

    // A kind's tab counts what its section lists: the memories it uses, not the guesses still to confirm.
    const grouped = groupMemories(found)
    const counts = new Map(grouped.groups.map((group) => [group.kind, group.memories.length]))
    const shownKind = kind !== "all" && (counts.get(kind) ?? 0) > 0 ? kind : "all"
    const { groups, toConfirm } = shownKind === "all" ?
      grouped :
      { groups: grouped.groups.filter((group) => group.kind === shownKind), toConfirm: [] }

    return (
      <>
        <FilterTabs
          label="Kind"
          value={shownKind}
          onChange={setKind}
          options={[
            { value: "all" as const, label: "All", count: found.length },
            ...MEMORY_GROUPS.filter((group) => (counts.get(group.kind) ?? 0) > 0).map((group) => ({
              value: group.kind,
              label: group.label,
              count: counts.get(group.kind) ?? 0
            }))
          ]}
        />

        {toConfirm.length === 0 ? null : (
          <MemoryGroup
            title="To confirm"
            count={toConfirm.length}
            tone="confirm"
            description="The assistant guessed these from your conversations. It doesn't use them until you confirm them."
          >
            {toConfirm.map((memory) => (
              <MemoryRow key={memory.id} memory={memory} agentName={agentName(memory)} now={now} />
            ))}
          </MemoryGroup>
        )}

        {groups.map((group) => (
          <MemoryGroup key={group.kind} title={group.label} count={group.memories.length}>
            {group.memories.map((memory) => (
              <MemoryRow key={memory.id} memory={memory} agentName={agentName(memory)} now={now} />
            ))}
          </MemoryGroup>
        ))}
      </>
    )
  }

  const any = AsyncResult.isSuccess(all) && all.value.length > 0

  return (
    <AppPage title="Memory" sub="What the assistant knows about you">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <p className="max-w-[54ch] text-[13.5px] leading-relaxed text-g-600">
          The assistant uses these to answer you. It keeps what you tell it, and asks before keeping what it infers.
          Deleting one also deletes the conversation turn it came from.
        </p>
        {any ?
          (
            <div className="flex flex-wrap items-start gap-2">
              <ExportMemories />
              <ForgetEverything />
            </div>
          ) :
          null}
      </div>

      {any ?
        (
          <InputGroup className="bg-white">
            <Icon name="search" size={16} />
            <InputGroupInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search memories"
              aria-label="Search memories"
              autoComplete="off"
            />
            {query === "" ? null : (
              <InputGroupButton aria-label="Clear the search" onClick={() => setQuery("")}>
                <Icon name="close" size={14} />
              </InputGroupButton>
            )}
          </InputGroup>
        ) :
        null}

      {body()}
    </AppPage>
  )
}
