import type { Memory, MemoryKind } from "@bluechip/domain/assistant/Memory"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { InputGroup, InputGroupButton, InputGroupInput } from "@bluechip/ui/components/input-group"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Tabs, TabsCount, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type ReactNode, useEffect, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
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
    <Empty size="sm" className="py-12 shadow-e2">
      <EmptyMedia>
        <Icon name="book" size={18} />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
      <EmptyContent>{action}</EmptyContent>
    </Empty>
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
      return (
        <div className="grid justify-items-center gap-3 rounded-lg bg-white px-5 py-10 text-center shadow-e2">
          <p className="text-body-sm text-g-600">
            We couldn't load your memories. Check your connection and try again.
          </p>
          <Button variant="secondary" size="sm" onClick={refresh}>
            <Icon name="refresh" size={14} />Try again
          </Button>
        </div>
      )
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

    const counts = new Map(MEMORY_GROUPS.map((group) => [
      group.kind,
      found.filter((memory) => memory.kind === group.kind).length
    ]))
    const shownKind = kind !== "all" && (counts.get(kind) ?? 0) > 0 ? kind : "all"
    const { groups, toConfirm } = groupMemories(
      shownKind === "all" ? found : found.filter((memory) => memory.kind === shownKind)
    )

    return (
      <>
        <Tabs variant="segmented" value={shownKind} onValueChange={(value) => setKind(value as MemoryKind | "all")}>
          <TabsList
            aria-label="Kind"
            className="[&_[role=tab]]:h-7 [&_[role=tab]]:gap-1.5 [&_[role=tab]]:px-3 [&_[role=tab]]:text-label-sm"
          >
            <TabsTab value="all">
              All<TabsCount>{found.length}</TabsCount>
            </TabsTab>
            {MEMORY_GROUPS.filter((group) => (counts.get(group.kind) ?? 0) > 0).map((group) => (
              <TabsTab key={group.kind} value={group.kind}>
                {group.label}
                <TabsCount>{counts.get(group.kind)}</TabsCount>
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>

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
