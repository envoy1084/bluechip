import { Button } from "@bluechip/ui/components/button"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { activityAtom } from "../../../atoms/activity.ts"
import { ActivityLine } from "../../../components/ActivityLine.tsx"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"

/** The three latest trades or withdrawals, with the way to the rest. Nothing shows before the first one. */
export function LatestActivity() {
  const activity = useAtomValue(activityAtom("all all"))
  const navigate = useNavigate()

  const { names } = useStockLookup()
  if (!AsyncResult.isSuccess(activity) || activity.value.items.length === 0) return null

  return (
    <section aria-labelledby="latest-activity" className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 id="latest-activity" className="text-body-sm font-semibold">Latest activity</h2>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/activity" />}>See all</Button>
      </div>
      <ul className="overflow-hidden rounded-lg bg-white shadow-e2">
        {activity.value.items.slice(0, 3).map((item) => (
          <ActivityLine
            key={item._tag === "Trade" ? item.trade.id : item.transfer.id}
            item={item}
            names={names}
            onOpen={() => navigate({ to: "/activity" })}
          />
        ))}
      </ul>
    </section>
  )
}
