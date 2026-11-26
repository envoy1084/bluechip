import type { ActivityItem, ActivityKind, ActivityPeriod } from "@bluechip/domain/activity/Activity"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as Array from "effect/Array"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useRef, useState } from "react"
import { activityAtom } from "../../../atoms/activity.ts"
import { agentsAtom } from "../../../atoms/agents.ts"
import { cashDialogAtom } from "../../../atoms/cashDialog.ts"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { activityAt, activityId } from "../../../lib/activityText.ts"
import { dayHeading } from "../../../lib/localTime.ts"
import { activityPagesAtom } from "../atoms/activity.ts"
import { ActivityDetails } from "../components/ActivityDetails.tsx"
import { ActivityEntry } from "../components/ActivityEntry.tsx"
import { ActivityFilters } from "../components/ActivityFilters.tsx"
import { ActivitySummary, ActivitySummarySkeleton } from "../components/ActivitySummary.tsx"
import { emptyActivity } from "../model/emptyActivity.ts"

type Kind = typeof ActivityKind.Type
type Period = typeof ActivityPeriod.Type

function ListSkeleton() {
  return (
    <div aria-busy className="grid gap-4 px-5 py-4">
      {[0, 1, 2].map((row) => (
        <div key={row} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3.5">
          <SkeletonBlock className="size-[34px] rounded-md" />
          <div className="grid gap-2">
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A page that didn't load, with a way to ask again. */
function PageProblem({ query, what }: Readonly<{ query: Parameters<typeof activityAtom>[0]; what: string }>) {
  const refresh = useAtomRefresh(activityAtom(query))
  return (
    <LoadProblem
      what={what}
      onRetry={refresh}
      size="sm"
      className="rounded-none border-t border-g-100 first:border-t-0"
    />
  )
}

/**
 * The empty list, with the way forward: cash to start with, or every type and period. It reads the whole history only
 * once a filter comes back empty, to know what to say.
 */
function EmptyActivity({ filtered, onShowAll }: Readonly<{ filtered: boolean; onShowAll: () => void }>) {
  const everything = useAtomValue(activityAtom("all all"))
  const openCash = useAtomSet(cashDialogAtom)
  const history = !AsyncResult.isSuccess(everything) ? "unknown" : everything.value.items.length === 0 ? "none" : "some"
  const { title, description } = emptyActivity(history, filtered)

  return (
    <IllustratedEmpty
      illustration="empty-inbox"
      title={title}
      size={120}
      action={history === "none" ?
        (
          <Button variant="secondary" size="sm" onClick={() => openCash("add")}>
            <Icon name="plus" size={14} />Add cash
          </Button>
        ) :
        filtered && history === "some" ?
        <Button variant="secondary" size="sm" onClick={onShowAll}>Show all activity</Button> :
        undefined}
    >
      {description}
    </IllustratedEmpty>
  )
}

/**
 * Every trade, deposit and withdrawal, filtered by type and period: the period's totals, then the items by day, each
 * opening its details, older ones page by page.
 */
export function ActivityScreen() {
  const [kind, setKind] = useState<Kind>("all")
  const [period, setPeriod] = useState<Period>("7d")
  const [pageTokens, setPageTokens] = useState<ReadonlyArray<string>>([""])
  const [selected, setSelected] = useState<ActivityItem | undefined>(undefined)
  const opener = useRef<HTMLElement | null>(null)
  const [now] = useState(() => new Date())

  const pages = useAtomValue(activityPagesAtom(`${kind} ${period} ${pageTokens.join(" ")}`))
  // An account with no activity at all has nothing to filter: the filters wait for its first item.
  const everything = useAtomValue(activityAtom("all all"))
  const nothingEver = AsyncResult.isSuccess(everything) && everything.value.items.length === 0
  const agents = useAtomValue(agentsAtom)
  const { names } = useStockLookup()

  const loadedCount = pages.findIndex((page) => !AsyncResult.isSuccess(page))
  const loaded = (loadedCount === -1 ? pages : pages.slice(0, loadedCount)).flatMap((page) =>
    AsyncResult.isSuccess(page) ? [page.value] : []
  )
  const pending = loadedCount === -1 ? undefined : pages[loadedCount]
  const nextPageToken = pending === undefined ? (loaded.at(-1)?.nextPageToken ?? null) : null
  const items = loaded.flatMap((page) => page.items)
  // Each day's items under its heading, in the order they came.
  const days = Array.groupBy(items, (item) => dayHeading(activityAt(item), now))

  const agentNames = new Map(AsyncResult.isSuccess(agents) ? agents.value.map((agent) => [agent.id, agent.name]) : [])
  const pageQuery = (index: number) => {
    const token = pageTokens[index] ?? ""
    return token === "" ? `${kind} ${period}` as const : `${kind} ${period} ${token}` as const
  }
  const filter = (next: { readonly kind?: Kind; readonly period?: Period }) => {
    setKind(next.kind ?? kind)
    setPeriod(next.period ?? period)
    setPageTokens([""])
  }

  const body = () => {
    if (loaded.length === 0 && pending !== undefined) {
      if (AsyncResult.isInitial(pending)) {
        return (
          <>
            <ActivitySummarySkeleton />
            <div className="overflow-hidden rounded-lg bg-white shadow-e2">
              <ListSkeleton />
            </div>
          </>
        )
      }
      return (
        <div className="overflow-hidden rounded-lg bg-white shadow-e2">
          <PageProblem query={pageQuery(0)} what="your activity" />
        </div>
      )
    }
    if (items.length === 0) {
      return (
        <div className="rounded-lg bg-white shadow-e2">
          <EmptyActivity
            filtered={kind !== "all" || period !== "all"}
            onShowAll={() => filter({ kind: "all", period: "all" })}
          />
        </div>
      )
    }

    return (
      <>
        <ActivitySummary items={items} kind={kind} partial={nextPageToken !== null || pending !== undefined} />
        <div className="overflow-hidden rounded-lg bg-white shadow-e2">
          {Object.entries(days).map(([day, dayItems]) => (
            <section key={day} aria-label={day}>
              <h2 className="border-b border-g-100 bg-g-50/70 px-5 py-2 text-caption font-semibold text-g-500">
                {day}
              </h2>
              <ul>
                {dayItems.map((item) => (
                  <ActivityEntry
                    key={activityId(item)}
                    item={item}
                    names={names}
                    agentName={(id) => agentNames.get(id)}
                    onOpen={(row) => {
                      opener.current = row
                      setSelected(item)
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
          {pending === undefined ?
            null :
            AsyncResult.isInitial(pending) ?
            <ListSkeleton /> :
            <PageProblem query={pageQuery(loadedCount)} what="your older activity" />}
          {nextPageToken === null ?
            null :
            (
              <div className="grid border-t border-g-100 p-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPageTokens((tokens) => [...tokens, nextPageToken])}
                >
                  Show older activity
                </Button>
              </div>
            )}
        </div>
      </>
    )
  }

  return (
    <AppPage title="Activity" sub="Every trade, and every dollar in and out">
      {nothingEver ? null : (
        <ActivityFilters
          kind={kind}
          period={period}
          onKind={(next) => filter({ kind: next })}
          onPeriod={(next) => filter({ period: next })}
        />
      )}
      {body()}
      <ActivityDetails item={selected} names={names} opener={opener} onClose={() => setSelected(undefined)} />
    </AppPage>
  )
}
