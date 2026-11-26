import type { ActivityItem, ActivityKind, ActivityPeriod } from "@bluechip/domain/activity/Activity"
import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDate } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { activityAtom } from "../../../atoms/activity.ts"
import { activityAt, ActivityLine } from "../../../components/ActivityLine.tsx"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { ActivityDetails } from "../components/ActivityDetails.tsx"
import { emptyActivity } from "../model/emptyActivity.ts"

type Kind = typeof ActivityKind.Type
type Period = typeof ActivityPeriod.Type

const PERIODS: ReadonlyArray<{ readonly value: Period; readonly label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" }
]

/** The day an item belongs to, as the list heads it: Today, Yesterday, then the date. */
const dayOf = (item: ActivityItem) => {
  const at = DateTime.toDateUtc(activityAt(item))
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000)
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : formatDate(at, { time: false, timeZone: localTimeZone() })
}

/** Every trade and withdrawal, by day, filtered by kind and period, each opening its details. */
export function ActivityScreen() {
  const [kind, setKind] = useState<Kind>("all")
  const [period, setPeriod] = useState<Period>("7d")
  const [selected, setSelected] = useState<ActivityItem | undefined>(undefined)
  const activity = useAtomValue(activityAtom(`${kind} ${period}`))
  const refresh = useAtomRefresh(activityAtom(`${kind} ${period}`))

  const { names } = useStockLookup()
  const items = AsyncResult.isSuccess(activity) ? activity.value.items : []
  const days = [...new Set(items.map(dayOf))]

  return (
    <AppPage title="Activity">
      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs variant="segmented" value={kind} onValueChange={(value) => setKind(value as Kind)}>
          <TabsList
            aria-label="Filter by type"
            className="[&_[role=tab]]:h-[28px] [&_[role=tab]]:px-3 [&_[role=tab]]:text-label-sm"
          >
            <TabsTab value="all">All</TabsTab>
            <TabsTab value="trades">Trades</TabsTab>
            <TabsTab value="cash">Cash</TabsTab>
          </TabsList>
        </Tabs>
        <Select items={PERIODS} value={period} onValueChange={(value) => value !== null && setPeriod(value as Period)}>
          <SelectTrigger size="sm" aria-label="Period" className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {AsyncResult.isInitial(activity) && <SkeletonBlock className="h-48 w-full" />}

      {AsyncResult.isFailure(activity) && (
        <div className="grid justify-items-center gap-3 py-10 text-center">
          <p className="text-body-sm text-g-600">
            We couldn't load your activity. Check your connection and try again.
          </p>
          <Button variant="secondary" onClick={refresh}>
            <Icon name="refresh" size={14} />Try again
          </Button>
        </div>
      )}

      {AsyncResult.isSuccess(activity) && items.length === 0 && (
        <EmptyActivity filtered={kind !== "all" || period !== "all"} />
      )}

      {days.map((day) => (
        <section key={day} className="grid gap-2">
          <h2 className="text-label-sm font-semibold text-g-500">{day}</h2>
          <ul className="overflow-hidden rounded-lg bg-white shadow-e2">
            {items.filter((item) => dayOf(item) === day).map((item) => (
              <ActivityLine
                key={item._tag === "Trade" ? item.trade.id : item.transfer.id}
                item={item}
                names={names}
                onOpen={() => setSelected(item)}
              />
            ))}
          </ul>
        </section>
      ))}

      <ActivityDetails item={selected} names={names} onClose={() => setSelected(undefined)} />
    </AppPage>
  )
}

/** The empty list. It reads the whole history only once a filter comes back empty, to know what to say. */
function EmptyActivity({ filtered }: Readonly<{ filtered: boolean }>) {
  const everything = useAtomValue(activityAtom("all all"))
  const history = !AsyncResult.isSuccess(everything) ? "unknown" : everything.value.items.length === 0 ? "none" : "some"
  const { title, description } = emptyActivity(history, filtered)

  return (
    <Empty variant="outline" size="sm">
      <EmptyMedia>
        <Icon name="activity" size={18} />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </Empty>
  )
}
