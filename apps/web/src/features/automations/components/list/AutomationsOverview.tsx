import { Tabs, TabsCount, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { localTimeZone } from "../../../../lib/localTime.ts"
import type { ListedAutomation } from "../../hooks/useListedAutomations.ts"
import { type Filter, filterCounts, FILTERS, runsToday, summaryDetail, summaryHeadline } from "../../model/standing.ts"

/**
 * How your automations stand at a glance: how many are running in a headline, which need a look, then the counts of
 * active, paused, needing attention and today's runs. `compact` drops the illustration, for an agent's page.
 */
export function AutomationsOverview(
  { listed, now, compact = false }: Readonly<{
    listed: ReadonlyArray<ListedAutomation>
    now: Date
    compact?: boolean
  }>
) {
  const counts = filterCounts(listed)
  const today = runsToday(listed.flatMap((each) => each.runs ?? []), now, localTimeZone())
  const needLook = listed.filter((each) => each.attention !== null).map((each) => each.automation.name)

  const tiles = [
    { label: "Active", value: counts.active, dot: "bg-gain", warn: false },
    { label: "Paused", value: counts.paused, dot: "bg-g-300", warn: false },
    { label: "Needs attention", value: counts.attention, dot: "bg-[#f5b400]", warn: counts.attention > 0 },
    { label: "Runs today", value: today, dot: "bg-g-500", warn: false }
  ]

  return (
    <section
      aria-label="Overview"
      className={cn(
        "grid items-center gap-5 rounded-lg bg-white p-5 shadow-e2",
        !compact && "sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6"
      )}
    >
      {compact ?
        null :
        (
          <Illustration
            name="bolt"
            variant="halftone"
            size={136}
            animate
            className="justify-self-center max-sm:hidden"
          />
        )}
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.025em] text-balance">
            {summaryHeadline(counts)}
          </h2>
          <p className={cn("text-body-sm text-pretty", needLook.length > 0 ? "text-warn" : "text-g-600")}>
            {summaryDetail(needLook, today)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className={cn(
                "grid gap-1 rounded-md px-3.5 py-3",
                tile.warn ? "bg-warn-wash shadow-[inset_0_0_0_1px_var(--color-warn-line)]" : "surface-well"
              )}
            >
              <dt className="flex items-center gap-1.5 text-label-sm text-g-600">
                <i aria-hidden className={cn("size-2 rounded-full", tile.dot)} />
                {tile.label}
              </dt>
              <dd>
                <NumberRoll
                  value={tile.value}
                  className={cn(
                    "text-[24px] leading-none font-semibold tracking-[-0.03em]",
                    tile.warn && "text-warn"
                  )}
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/** All, Active, Paused or Needs attention, each with how many it shows. */
export function FilterTabs(
  { listed, filter, onChange }: Readonly<{
    listed: ReadonlyArray<ListedAutomation>
    filter: Filter
    onChange: (filter: Filter) => void
  }>
) {
  const counts = filterCounts(listed)

  return (
    <Tabs variant="segmented" value={filter} onValueChange={(value) => onChange(value as Filter)}>
      <TabsList aria-label="Show" className="[&_[role=tab]]:h-[28px] [&_[role=tab]]:px-3 [&_[role=tab]]:text-label-sm">
        {FILTERS.map((option) => (
          <TabsTab key={option.value} value={option.value} className="gap-1.5">
            {option.label}
            <TabsCount className={option.value === "attention" && counts.attention > 0 ? "bg-warn-wash text-warn" : ""}>
              {counts[option.value]}
            </TabsCount>
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  )
}
