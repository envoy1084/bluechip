import type { ActivityKind, ActivityPeriod } from "@bluechip/domain/activity/Activity"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"

type Kind = typeof ActivityKind.Type
type Period = typeof ActivityPeriod.Type

const KINDS: ReadonlyArray<{ readonly value: Kind; readonly label: string; readonly icon: IconName }> = [
  { value: "all", label: "All", icon: "activity" },
  { value: "trades", label: "Trades", icon: "chart-line" },
  { value: "cash", label: "Cash", icon: "cash" }
]

const PERIODS: ReadonlyArray<{ readonly value: Period; readonly label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" }
]

/** Which activity to list: its type on the left, how far back on the right. */
export function ActivityFilters(
  { kind, period, onKind, onPeriod }: Readonly<{
    kind: Kind
    period: Period
    onKind: (kind: Kind) => void
    onPeriod: (period: Period) => void
  }>
) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <Tabs variant="segmented" value={kind} onValueChange={(value) => onKind(value as Kind)}>
        <TabsList
          aria-label="Filter by type"
          className="[&_[role=tab]]:h-[30px] [&_[role=tab]]:gap-1.5 [&_[role=tab]]:px-3 [&_[role=tab]]:text-label-sm"
        >
          {KINDS.map((option) => (
            <TabsTab key={option.value} value={option.value}>
              <Icon name={option.icon} size={14} />
              {option.label}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>
      <Select items={PERIODS} value={period} onValueChange={(value) => value !== null && onPeriod(value as Period)}>
        <SelectTrigger size="sm" aria-label="Period" className="w-[160px] bg-white">
          <span className="flex items-center gap-1.5">
            <Icon name="calendar" size={14} className="text-g-500" />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
