import type { AuditType } from "@bluechip/domain/audit/Audit"
import type { AgentId } from "@bluechip/domain/Ids"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type ReactNode, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { localTimeZone } from "../../../lib/localTime.ts"
import { type AuditFilter, auditPageAtom, auditPagesAtom, exportAuditAtom } from "../atoms/audit.ts"
import { AuditProblem, AuditSkeleton, AuditTable } from "../components/AuditTable.tsx"
import { AuditToolbar } from "../components/AuditToolbar.tsx"
import { type AuditDays, auditDays, type AuditRangePreset, localDay } from "../model/auditRange.ts"
import { actorLabel, auditSubject, describeAudit, matchesAuditSearch } from "../model/auditText.ts"

/** A page that didn't load, asked for again on its own. */
function PageProblem({ filter, pageToken, what }: Readonly<{
  filter: AuditFilter
  pageToken: string | null
  what: string
}>) {
  const refresh = useAtomRefresh(auditPageAtom(JSON.stringify({ filter, pageToken })))
  return <AuditProblem what={what} onRetry={refresh} />
}

/** An empty state inside the log's card: an icon, what's empty and why, and the way out. */
function AuditEmpty(
  { title, description, action }: Readonly<{ title: string; description: string; action?: ReactNode }>
) {
  return (
    <div className="rounded-lg bg-white shadow-e2">
      <Empty variant="plain" size="sm" className="py-12">
        <EmptyMedia>
          <Icon name="book" size={18} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
        {action === undefined ? null : <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  )
}

/**
 * The audit log: everything that happened to the account, as a table by day, filtered by kind, agent and days,
 * searched in what's loaded, and saved as JSON.
 */
export function AuditScreen() {
  const [type, setType] = useState<AuditType | null>(null)
  const [agentId, setAgentId] = useState<AgentId | null>(null)
  const [range, setRange] = useState<AuditRangePreset>("any")
  const [custom, setCustom] = useState<AuditDays>({ from: null, to: null })
  const [search, setSearch] = useState("")
  const [pageTokens, setPageTokens] = useState<ReadonlyArray<string | null>>([null])
  const [now] = useState(() => new Date())
  const timeZone = localTimeZone()

  const agents = useAtomValue(agentsAtom)
  const exportAudit = useAtomSet(exportAuditAtom, { mode: "promise" })
  const [exporting, setExporting] = useState(false)
  const [problem, setProblem] = useState<string | undefined>(undefined)

  const filter: AuditFilter = { type, agentId, ...auditDays(range, localDay(now, timeZone), custom) }
  const pages = useAtomValue(auditPagesAtom(JSON.stringify({ filter, pageTokens })))

  const agentList = AsyncResult.isSuccess(agents) ? agents.value : []
  const agentNames = new Map<string, string>(agentList.map((agent) => [agent.id, agent.name]))
  const agentName = (id: string) => agentNames.get(id)

  const loadedCount = pages.findIndex((page) => !AsyncResult.isSuccess(page))
  const loaded = (loadedCount === -1 ? pages : pages.slice(0, loadedCount)).flatMap((page) =>
    AsyncResult.isSuccess(page) ? [page.value] : []
  )
  const pending = loadedCount === -1 ? undefined : pages[loadedCount]
  const nextPageToken = pending === undefined ? (loaded.at(-1)?.nextPageToken ?? null) : null
  const events = loaded.flatMap((page) => page.items)
  const shown = search.trim() === "" ? events : events.filter((event) =>
    matchesAuditSearch(
      [describeAudit(event), actorLabel(event, agentName), auditSubject(event, agentName)?.label ?? ""],
      search
    )
  )

  const filtered = type !== null || agentId !== null || range !== "any"

  // A new filter starts again from its first page; a search only narrows what's loaded.
  const refilter = (change: () => void) => {
    change()
    setPageTokens([null])
  }
  const clearFilters = () =>
    refilter(() => {
      setType(null)
      setAgentId(null)
      setRange("any")
    })
  const loadOlder = () => {
    if (nextPageToken !== null) setPageTokens((tokens) => [...tokens, nextPageToken])
  }

  const download = async () => {
    setExporting(true)
    setProblem(undefined)
    try {
      const json = await exportAudit(filter)
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
      const link = document.createElement("a")
      link.href = url
      link.download = `bluechip-audit-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setProblem("We couldn't reach bluechip just now, so nothing was downloaded. Try again.")
    }
    setExporting(false)
  }

  const footer = () => {
    if (pending !== undefined) {
      return AsyncResult.isInitial(pending) ?
        <AuditSkeleton rows={3} /> :
        <PageProblem filter={filter} pageToken={pageTokens[loadedCount] ?? null} what="older entries" />
    }
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-lg px-4 py-2.5 text-label-sm text-g-500">
        <span className="tabular-nums">
          {search.trim() === "" ?
            `${events.length} ${events.length === 1 ? "entry" : "entries"}${nextPageToken === null ? "" : " so far"}` :
            `${shown.length} of ${events.length} loaded ${events.length === 1 ? "entry" : "entries"} match`}
        </span>
        {nextPageToken === null ?
          <span>That's the start of your log.</span> :
          (
            <Button variant="ghost" size="sm" onClick={loadOlder}>
              Show older<Icon name="chevron-down" size={14} />
            </Button>
          )}
      </div>
    )
  }

  const body = () => {
    const first = pages[0]
    if (loaded.length === 0 && first !== undefined) {
      if (AsyncResult.isInitial(first)) {
        return (
          <div className="rounded-lg bg-white shadow-e2">
            <AuditSkeleton />
          </div>
        )
      }
      return (
        <div className="rounded-lg bg-white shadow-e2">
          <PageProblem filter={filter} pageToken={null} what="the audit log" />
        </div>
      )
    }
    if (events.length === 0) {
      return (
        <AuditEmpty
          title={filtered ? "Nothing matches" : "Nothing here yet"}
          description={filtered ?
            "Nothing your account did matches these filters." :
            "What you, your agents and bluechip do to your account shows here."}
          action={filtered ?
            <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> :
            undefined}
        />
      )
    }
    if (shown.length === 0) {
      return (
        <AuditEmpty
          title={`No entry matches “${search.trim()}”`}
          description={nextPageToken === null ?
            "Try other words, or clear the search." :
            "The search looks through the entries loaded so far. Show older ones to search further back."}
          action={
            <>
              <Button variant="secondary" size="sm" onClick={() => setSearch("")}>Clear the search</Button>
              {nextPageToken === null
                ? null
                : <Button variant="ghost" size="sm" onClick={loadOlder}>Show older</Button>}
            </>
          }
        />
      )
    }
    return <AuditTable events={shown} agentName={agentName} now={now} timeZone={timeZone} footer={footer()} />
  }

  return (
    <AppPage
      title="Audit log"
      sub="Everything you, your agents and bluechip did"
      width="wide"
      actions={
        <Button variant="secondary" size="sm" loading={exporting} onClick={() => void download()}>
          <Icon name="download" size={14} />Export JSON
        </Button>
      }
    >
      <AuditToolbar
        type={type}
        onType={(next) => refilter(() => setType(next))}
        agentId={agentId}
        onAgent={(next) => refilter(() => setAgentId(next))}
        agents={agentList}
        range={range}
        onRange={(next) => refilter(() => setRange(next))}
        custom={custom}
        onCustom={(next) => refilter(() => setCustom(next))}
        search={search}
        onSearch={setSearch}
      />

      {problem === undefined ? null : (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}

      {body()}
    </AppPage>
  )
}
