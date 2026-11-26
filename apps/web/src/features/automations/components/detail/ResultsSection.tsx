import type { AutomationId } from "@bluechip/domain/Ids"
import type { AutomationPerformance } from "@bluechip/domain/performance/Performance"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import { formatChange, formatMoney } from "@bluechip/ui/lib/format"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { ReactNode } from "react"
import { usdcDollars } from "../../../../lib/amounts.ts"
import { costsSentence } from "../../../../lib/performance.ts"
import { automationPerformanceAtom } from "../../atoms/performance.ts"
import { OUTCOME } from "../../model/automationText.ts"
import { runsSentence } from "../../model/results.ts"
import { OUTCOME_MARK } from "../RunStrip.tsx"

/** A results card: an illustration, a title and what it's about, then its body; a last `mt-auto` child sits at the bottom. */
function Panel(
  { illustration, title, sub, children }: Readonly<{
    illustration: IllustrationName
    title: string
    sub: string
    children: ReactNode
  }>
) {
  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-e2">
      <header className="flex items-center gap-3">
        <Illustration name={illustration} size={40} label="" aria-hidden className="shrink-0" />
        <div className="grid gap-0.5">
          <h3 className="text-[14.5px] font-semibold tracking-[-0.01em]">{title}</h3>
          <p className="text-label-sm text-g-500">{sub}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

/** A bar that grows to its share, still under reduced motion. */
function Bar({ share, tone }: Readonly<{ share: number; tone: string }>) {
  return (
    <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-g-100">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-brand motion-reduce:transition-none",
          tone
        )}
        style={{ width: `${Math.round(share * 100)}%` }}
      />
    </div>
  )
}

/** How its runs ended, as one bar split by outcome with a count for each. */
function RunOutcomes({ performance }: Readonly<{ performance: AutomationPerformance }>) {
  const shown = performance.outcomes.filter((row) => row.count > 0)

  return (
    <Panel
      illustration="bolt"
      title="How its runs ended"
      sub={`${performance.runs} ${performance.runs === 1 ? "run" : "runs"} in all`}
    >
      <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-g-100">
        {shown.map((row) => (
          <div
            key={row.outcome}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", OUTCOME_MARK[row.outcome])}
            style={{ flexGrow: row.count }}
          />
        ))}
      </div>
      <ul className="grid gap-2">
        {shown.map((row) => (
          <li key={row.outcome} className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="flex items-center gap-2 text-g-700">
              <i aria-hidden className={cn("size-2 rounded-full", OUTCOME_MARK[row.outcome])} />
              {OUTCOME[row.outcome].label}
            </span>
            <b className="font-semibold tabular-nums">{row.count}</b>
          </li>
        ))}
      </ul>
      <p className="mt-auto border-t border-g-100 pt-3 text-label-sm text-g-600">
        {runsSentence(performance.runs, performance.outcomes)}
      </p>
    </Panel>
  )
}

/** What its trades bought and sold, side by side. */
function MoneyMoved({ performance }: Readonly<{ performance: AutomationPerformance }>) {
  const bought = usdcDollars(performance.bought)
  const sold = usdcDollars(performance.sold)
  const most = Math.max(bought, sold, 1)

  return (
    <Panel
      illustration="coins"
      title="Money moved"
      sub={`${performance.trades} ${performance.trades === 1 ? "trade" : "trades"} filled`}
    >
      {[
        { label: "Bought", value: bought, tone: "bg-blue" },
        { label: "Sold", value: sold, tone: "bg-g-400" }
      ].map((row) => (
        <div key={row.label} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2 text-[13.5px] text-g-700">
              <i aria-hidden className={cn("size-2 rounded-full", row.tone)} />
              {row.label}
            </span>
            <NumberRoll
              value={row.value}
              format={(value) => formatMoney(value)}
              className="text-[13.5px] font-semibold"
            />
          </div>
          <Bar share={row.value / most} tone={row.tone} />
        </div>
      ))}
      <p className="mt-auto border-t border-g-100 pt-3 text-label-sm text-g-600">
        {performance.trades === 0
          ? "None of its runs has filled a trade yet."
          : `Costs: ${costsSentence(performance.costs)}.`}
      </p>
    </Panel>
  )
}

/** The profit its sales locked in, signed and colored. */
function Realised({ performance }: Readonly<{ performance: AutomationPerformance }>) {
  const realised = usdcDollars(performance.realised)

  return (
    <Panel illustration="chart" title="Realised" sub="From what its trades sold">
      <NumberRoll
        value={realised}
        format={(value) => formatChange(value)}
        className={cn(
          "text-[30px] leading-none font-semibold tracking-[-0.035em]",
          realised > 0 ? "text-gain" : realised < 0 ? "text-loss" : "text-g-600"
        )}
      />
      <p className="mt-auto border-t border-g-100 pt-3 text-label-sm text-g-600">
        {performance.sold === BigInt(0) ?
          "Nothing sold yet, so nothing is locked in." :
          `On ${formatMoney(usdcDollars(performance.sold))} it sold.`}
      </p>
    </Panel>
  )
}

/** What the automation's runs came to: how they ended, the money its trades moved, and what their sales locked in. */
export function ResultsSection({ automationId }: Readonly<{ automationId: AutomationId }>) {
  const result = useAtomValue(automationPerformanceAtom(automationId))
  if (!AsyncResult.isSuccess(result) || result.value.runs === 0) return null

  const performance = result.value
  return (
    <section aria-labelledby="results" className="grid gap-3">
      <div className="grid gap-0.5 px-0.5">
        <h2 id="results" className="text-[16px] font-semibold tracking-[-0.015em]">Results</h2>
        <p className="text-label-sm text-g-500">What its runs came to, from the ledger.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <RunOutcomes performance={performance} />
        <MoneyMoved performance={performance} />
        <Realised performance={performance} />
      </div>
    </section>
  )
}
