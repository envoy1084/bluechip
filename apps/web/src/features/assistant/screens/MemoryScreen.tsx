import type { Memory } from "@bluechip/domain/assistant/Memory"
import { Button } from "@bluechip/ui/components/button"
import { InputGroup, InputGroupInput } from "@bluechip/ui/components/input-group"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { memoriesAtom } from "../atoms/assistant.ts"
import { ExportMemories } from "../components/memory/ExportMemories.tsx"
import { ForgetEverything } from "../components/memory/ForgetEverything.tsx"
import { MemoryRow } from "../components/memory/MemoryRow.tsx"

// A search runs once typing has settled for this long.
const SEARCH_SETTLE_MS = 250

function Memories({ search }: Readonly<{ search: string }>) {
  const memories = useAtomValue(memoriesAtom(search))
  const refresh = useAtomRefresh(memoriesAtom(search))
  const agents = useAtomValue(agentsAtom)
  const agentName = (memory: Memory) =>
    memory.agentId === null || !AsyncResult.isSuccess(agents) ?
      undefined :
      agents.value.find((agent) => agent.id === memory.agentId)?.name

  if (AsyncResult.isInitial(memories)) {
    return (
      <div aria-busy className="grid gap-3 py-4">
        {[0, 1, 2].map((row) => <SkeletonBlock key={row} className="h-14 w-full rounded-md" />)}
      </div>
    )
  }
  if (!AsyncResult.isSuccess(memories)) {
    return (
      <div className="grid justify-items-center gap-3 py-10 text-center">
        <p className="text-body-sm text-g-600">We couldn't load your memories. Check your connection and try again.</p>
        <Button variant="secondary" onClick={refresh}>Try again</Button>
      </div>
    )
  }
  if (memories.value.length === 0) {
    return (
      <p className="py-10 text-center text-body-sm text-g-600">
        {search === "" ?
          "Nothing yet. Tell the assistant what matters to you, like \"I never want to own Tesla\", and it remembers." :
          `No memory matches “${search}”.`}
      </p>
    )
  }
  return (
    <ul>
      {memories.value.map((memory) => <MemoryRow key={memory.id} memory={memory} agentName={agentName(memory)} />)}
    </ul>
  )
}

/**
 * What the assistant remembers about you, where each memory came from and how often answers used it: searchable, to
 * export, and to delete one or all of.
 */
export function MemoryScreen() {
  const all = useAtomValue(memoriesAtom(""))
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const settle = setTimeout(() => setSearch(query.trim()), SEARCH_SETTLE_MS)
    return () => clearTimeout(settle)
  }, [query])

  const any = AsyncResult.isSuccess(all) && all.value.length > 0

  return (
    <AppPage title="Memory" sub="What bluechip remembers about you">
      <section className="rounded-lg bg-white px-[22px] pt-0.5 pb-1 shadow-e2">
        <div className="grid gap-3.5 border-b border-g-100 pt-[18px] pb-3.5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <h3 className="text-base font-semibold tracking-[-0.02em]">Memories</h3>
              <p className="text-[13.5px] text-g-600">
                The assistant uses these to answer you. It keeps what you tell it, and asks before keeping what it
                infers.
              </p>
            </div>
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
              <InputGroup className="sm:max-w-[320px]">
                <Icon name="search" size={16} />
                <InputGroupInput
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search memories"
                  aria-label="Search memories"
                  autoComplete="off"
                />
              </InputGroup>
            ) :
            null}
        </div>
        <Memories search={search} />
      </section>
    </AppPage>
  )
}
