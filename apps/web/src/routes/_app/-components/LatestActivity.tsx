import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Button } from "@bluechip/ui/components/button"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useMemo } from "react"
import { ActivityLine } from "../../../activity/ActivityLine.tsx"
import { activityAtom } from "../../../atoms/activity.ts"
import { stocksAtom } from "../../../atoms/market.ts"

/** The three latest trades or withdrawals, with the way to the rest. Nothing shows before the first one. */
export function LatestActivity() {
  const activity = useAtomValue(activityAtom("all all"))
  const stocks = useAtomValue(stocksAtom)
  const navigate = useNavigate()

  const names = useMemo(
    () =>
      new Map<StockSymbol, string>(
        AsyncResult.isSuccess(stocks) ? stocks.value.map((stock) => [stock.symbol, stock.name]) : []
      ),
    [stocks]
  )
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
