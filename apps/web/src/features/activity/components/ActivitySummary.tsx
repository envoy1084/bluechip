import type { ActivityItem, ActivityKind } from "@bluechip/domain/activity/Activity"
import { StatGrid, StatTile } from "@bluechip/ui/bluechip/stat-tile"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { activityTotals, summaryTiles } from "../model/activitySummary.ts"

const CARD = "grid gap-3 rounded-lg bg-white px-5 py-4 shadow-e2"

export function ActivitySummarySkeleton() {
  return (
    <div aria-busy className={CARD}>
      <SkeletonBlock className="h-12 w-full" />
    </div>
  )
}

/**
 * The period at a glance: what was bought and sold and the cash that came and went, of the items listed. While older
 * pages wait to be loaded (`partial`), it says it counts only what's shown.
 */
export function ActivitySummary(
  { items, kind, partial }: Readonly<{
    items: ReadonlyArray<ActivityItem>
    kind: typeof ActivityKind.Type
    partial: boolean
  }>
) {
  const tiles = summaryTiles(activityTotals(items), kind)

  return (
    <section aria-label="Summary" className={CARD}>
      <StatGrid className="sm:grid-cols-[repeat(auto-fit,minmax(110px,1fr))]">
        {tiles.map((tile) => <StatTile key={tile.label} label={tile.label} value={tile.value} detail={tile.detail} />)}
      </StatGrid>
      {partial ?
        (
          <p className="border-t border-g-100 pt-2.5 text-label-sm text-g-500">
            Counts what's listed below. Show older activity to count the rest.
          </p>
        ) :
        null}
    </section>
  )
}
