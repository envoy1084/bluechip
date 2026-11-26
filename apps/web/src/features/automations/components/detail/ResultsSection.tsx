import type { AutomationId } from "@bluechip/domain/Ids"
import { StatGrid, StatTile } from "@bluechip/ui/bluechip/stat-tile"
import { formatChange, formatMoney } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { usdcDollars } from "../../../../lib/amounts.ts"
import { costsSentence } from "../../../../lib/performance.ts"
import { automationPerformanceAtom } from "../../atoms/performance.ts"
import { runsSentence } from "../../model/results.ts"

/** What the automation's runs came to: how they ended, the trades they made, and what those made and cost. */
export function ResultsSection({ automationId }: Readonly<{ automationId: AutomationId }>) {
  const result = useAtomValue(automationPerformanceAtom(automationId))
  if (!AsyncResult.isSuccess(result)) return null

  const performance = result.value
  return (
    <section aria-labelledby="results" className="grid gap-2.5">
      <h2 id="results" className="px-0.5 text-label-sm font-semibold text-g-500">Results</h2>
      <div className="grid gap-4 rounded-lg bg-white p-[18px] shadow-e2">
        <StatGrid>
          <StatTile label="Trades" value={performance.trades} />
          <StatTile label="Bought" value={formatMoney(usdcDollars(performance.bought))} />
          <StatTile label="Sold" value={formatMoney(usdcDollars(performance.sold))} />
          <StatTile
            label="Realised"
            value={formatChange(usdcDollars(performance.realised))}
            detail="From what its trades sold"
          />
        </StatGrid>
        <p className="text-label-sm text-g-600">
          {runsSentence(performance.runs, performance.outcomes)}
          {performance.trades === 0 ? "" : ` Costs: ${costsSentence(performance.costs)}.`}
        </p>
      </div>
    </section>
  )
}
