import type { AuditType } from "@bluechip/domain/audit/Audit"
import type { AgentId } from "@bluechip/domain/Ids"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { Input } from "@bluechip/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDate } from "@bluechip/ui/lib/format"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { localTimeZone } from "../../../lib/localTime.ts"
import { type AuditFilter, auditPageAtom, exportAuditAtom } from "../atoms/audit.ts"
import { actorLabel, AUDIT_TYPES, describeAudit } from "../model/auditText.ts"

// The Select's value for "everything": Base UI's items need a value.
const ALL = "all"

/** One page of the log; the last page loaded offers the next. */
function AuditPage(
  { filter, onMore, pageToken }: Readonly<{
    filter: AuditFilter
    pageToken: string | null
    onMore: ((token: string) => void) | undefined
  }>
) {
  const page = useAtomValue(auditPageAtom(JSON.stringify({ filter, pageToken })))
  const timeZone = localTimeZone()

  if (AsyncResult.isInitial(page)) return <SkeletonBlock className="h-40 w-full" />
  if (AsyncResult.isFailure(page)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>We couldn't load the audit log. Check your connection and try again.</AlertDescription>
      </Alert>
    )
  }
  if (page.value.items.length === 0 && pageToken === null) {
    return (
      <Empty variant="outline" size="sm">
        <EmptyMedia>
          <Icon name="book" size={18} />
        </EmptyMedia>
        <EmptyTitle>Nothing here</EmptyTitle>
        <EmptyDescription>Nothing your account did matches these filters.</EmptyDescription>
      </Empty>
    )
  }

  const next = page.value.nextPageToken
  return (
    <>
      <ul className="overflow-hidden rounded-lg bg-white shadow-e2">
        {page.value.items.map((event) => (
          <li
            key={event.id}
            data-testid="audit-event"
            className="grid gap-0.5 border-b border-g-100 px-[18px] py-3 last:border-b-0"
          >
            <b className="text-sm font-semibold">{describeAudit(event)}</b>
            <span className="text-[12.5px] text-g-500">
              {actorLabel(event)}, {formatDate(DateTime.toDateUtc(event.at), { timeZone })}
            </span>
          </li>
        ))}
      </ul>
      {next !== null && onMore !== undefined ?
        <Button variant="secondary" className="justify-self-center" onClick={() => onMore(next)}>Show older</Button> :
        null}
    </>
  )
}

/** The audit log: everything that happened to the account, filtered by kind, agent and days, and saved as JSON. */
export function AuditScreen() {
  const [filter, setFilter] = useState<AuditFilter>({ type: null, agentId: null, from: null, to: null })
  const [pages, setPages] = useState<ReadonlyArray<string | null>>([null])
  const agents = useAtomValue(agentsAtom)
  const exportAudit = useAtomSet(exportAuditAtom, { mode: "promise" })
  const [exporting, setExporting] = useState(false)
  const [problem, setProblem] = useState<string | undefined>(undefined)

  const change = (next: Partial<AuditFilter>) => {
    setFilter((current) => ({ ...current, ...next }))
    setPages([null])
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

  const types = [{ value: ALL, label: "Everything" }, ...AUDIT_TYPES]
  const agentItems = [
    { value: ALL, label: "Every agent" },
    ...(AsyncResult.isSuccess(agents) ? agents.value : []).map((agent) => ({ value: agent.id, label: agent.name }))
  ]

  return (
    <AppPage
      title="Audit log"
      actions={
        <Button variant="secondary" size="sm" loading={exporting} onClick={() => void download()}>
          <Icon name="download" size={14} />Export JSON
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          items={types}
          value={filter.type ?? ALL}
          onValueChange={(value) => value !== null && change({ type: value === ALL ? null : value as AuditType })}
        >
          <SelectTrigger size="sm" aria-label="Kind" className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          items={agentItems}
          value={filter.agentId ?? ALL}
          onValueChange={(value) => value !== null && change({ agentId: value === ALL ? null : value as AgentId })}
        >
          <SelectTrigger size="sm" aria-label="Agent" className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {agentItems.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}
            </SelectItem>)}
          </SelectContent>
        </Select>
        <label htmlFor="audit-from" className="flex items-center gap-1.5 text-label-sm text-g-500">
          From
          <Input
            id="audit-from"
            type="date"
            className="h-8 w-[150px]"
            value={filter.from ?? ""}
            onChange={(event) => change({ from: event.target.value === "" ? null : event.target.value })}
          />
        </label>
        <label htmlFor="audit-to" className="flex items-center gap-1.5 text-label-sm text-g-500">
          To
          <Input
            id="audit-to"
            type="date"
            className="h-8 w-[150px]"
            value={filter.to ?? ""}
            onChange={(event) => change({ to: event.target.value === "" ? null : event.target.value })}
          />
        </label>
      </div>

      {problem === undefined ? null : (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}

      {pages.map((pageToken, index) => (
        <AuditPage
          key={pageToken ?? "first"}
          filter={filter}
          pageToken={pageToken}
          onMore={index === pages.length - 1 ? (token) => setPages([...pages, token]) : undefined}
        />
      ))}
    </AppPage>
  )
}
