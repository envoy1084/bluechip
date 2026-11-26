import type { Agent } from "@bluechip/domain/agents/Agent"
import type { AgentPerformance } from "@bluechip/domain/performance/Performance"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatPercent } from "@bluechip/domain/policies/Format"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { StatGrid, StatTile } from "@bluechip/ui/bluechip/stat-tile"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { formatChange, formatMoney } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { IllustratedEmpty } from "../../../../components/IllustratedEmpty.tsx"
import { usdcDollars } from "../../../../lib/amounts.ts"
import { costsSentence } from "../../../../lib/performance.ts"
import { agentPerformanceAtom } from "../../atoms/performance.ts"
import { blockedSentence } from "../../model/results.ts"

function Drift({ drift }: Readonly<{ drift: NonNullable<AgentPerformance["drift"]> }>) {
  const latest = drift.at(-1)
  if (latest === undefined) return null

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] text-g-600">Drift from its target mix</span>
        <b className="text-[13.5px] font-semibold tabular-nums">{formatPercent(latest.driftBps)}</b>
      </div>
      {drift.length < 2 ? null : (
        <Sparkline
          values={drift.map((point) => point.driftBps / 100)}
          width={280}
          height={40}
          tone={latest.driftBps >= latest.triggerBps ? "down" : "flat"}
          area
          label={`Drift over the last 30 days, ${formatPercent(latest.driftBps)} now`}
          className="w-full"
        />
      )}
      <span className="text-caption text-g-500">
        It rebalances once the mix is {formatPercent(latest.triggerBps)} off.
      </span>
    </div>
  )
}

/** What the agent contributed: profit from its trades, what it bought and sold and paid, and what its policies held back. */
export function ResultsCard({ agent }: Readonly<{ agent: Agent }>) {
  const result = useAtomValue(agentPerformanceAtom(agent.id))

  return (
    <section aria-labelledby={`results-${agent.id}`} className="grid content-start gap-2.5">
      <h3 id={`results-${agent.id}`} className="px-0.5 text-label-sm font-semibold text-g-500">Results</h3>
      {AsyncResult.isSuccess(result) && result.value.trades === 0 && result.value.drift === null ?
        (
          <IllustratedEmpty illustration="chart" title="No results yet">
            Once {agent.name} trades, its profit, what it bought and sold, and its costs show up here.
          </IllustratedEmpty>
        ) :
        (
          <div className="grid gap-4 rounded-lg bg-white p-[18px] shadow-e2">
            {AsyncResult.isSuccess(result) ?
              (
                <>
                  <StatGrid>
                    <StatTile
                      label="Contribution"
                      value={formatChange(usdcDollars(result.value.realised + result.value.unrealised))}
                      detail={`${formatChange(usdcDollars(result.value.realised))} realised`}
                    />
                    <StatTile label="Bought" value={formatMoney(usdcDollars(result.value.bought))} />
                    <StatTile label="Sold" value={formatMoney(usdcDollars(result.value.sold))} />
                    <StatTile label="Trades" value={result.value.trades} />
                  </StatGrid>
                  <p className="text-label-sm text-g-600">
                    {result.value.trades === 0 ? "No trades yet." : `Costs: ${costsSentence(result.value.costs)}.`}{" "}
                    {blockedSentence(result.value, (policy) => policyOf(policy).title)}
                  </p>
                  {result.value.drift === null ? null : <Drift drift={result.value.drift} />}
                </>
              ) :
              AsyncResult.isFailure(result) ?
              <p className="text-label-sm text-g-600">Its results couldn't be read right now.</p> :
              <SkeletonBlock aria-busy className="h-16 w-full" />}
          </div>
        )}
    </section>
  )
}
