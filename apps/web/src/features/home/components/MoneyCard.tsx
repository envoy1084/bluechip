import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import { MixBar, mixColor } from "@bluechip/ui/bluechip/mix-bar"
import { MoneyCard as MoneyCardFrame, MoneyCardSkeleton } from "@bluechip/ui/bluechip/portfolio-summary"
import { Sparkline, sparklineTone } from "@bluechip/ui/bluechip/sparkline"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { cashDialogAtom } from "../../../atoms/cashDialog.ts"
import { portfolioAtom, portfolioHistoryAtom } from "../../../atoms/portfolio.ts"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { usdcDollars } from "../../../lib/amounts.ts"
import { track } from "../../../lib/analytics.ts"
import { moneySummary } from "../../../lib/moneySummary.ts"
import { mixParts, wholePercents } from "../model/holdings.ts"

const WEEK = 7 * 86_400_000
const TREND = { up: "up", down: "down", flat: "flat", brand: "flat" } as const

/** The last 7 days of your money, ending now; nothing until there are two points to draw. */
function WeekSpark({ portfolio }: Readonly<{ portfolio: Portfolio }>) {
  const history = useAtomValue(portfolioHistoryAtom)
  if (!AsyncResult.isSuccess(history)) return null

  const since = DateTime.toEpochMillis(portfolio.asOf) - WEEK
  const values = [
    ...history.value.filter((point) => DateTime.toEpochMillis(point.at) >= since).map((point) =>
      usdcDollars(point.value)
    ),
    usdcDollars(portfolio.value)
  ]
  if (values.length < 3) return null

  const tone = sparklineTone(values)
  return (
    <div className="grid justify-items-end gap-1 max-sm:hidden">
      <Sparkline values={values} width={148} height={44} area label={`Your money over 7 days, ${TREND[tone]}`} />
      <span className="text-label-sm text-g-500">Last 7 days</span>
    </div>
  )
}

/**
 * Your money on home, on the money card the portfolio shares: what it's worth with today's move and the week's shape,
 * what it's in as one strip (whole percents that add up), and your cash with Add cash. Loading keeps its shape; a
 * failed read offers Try again.
 */
export function MoneyCard() {
  const portfolio = useAtomValue(portfolioAtom)
  const refresh = useAtomRefresh(portfolioAtom)
  const openCash = useAtomSet(cashDialogAtom)
  const { nameOf } = useStockLookup()

  if (AsyncResult.isInitial(portfolio)) return <MoneyCardSkeleton />
  if (!AsyncResult.isSuccess(portfolio)) {
    return <LoadProblem what="your money" onRetry={refresh} safe variant="card" />
  }

  const { value, dayChange, dayChangePercent, cash } = moneySummary(portfolio.value, nameOf)
  const parts = mixParts(portfolio.value, nameOf)
  const percents = wholePercents(parts)

  return (
    <MoneyCardFrame
      value={value}
      dayChange={dayChange}
      dayChangePercent={dayChangePercent}
      aside={<WeekSpark portfolio={portfolio.value} />}
    >
      {parts.length === 0 ? null : (
        <div className="grid gap-2">
          <MixBar parts={parts} />
          <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-label-sm" aria-hidden>
            {parts.map((part, index) => (
              <li key={part.id} className="flex items-center gap-1.5">
                <i className="size-2 rounded-full" style={{ background: mixColor(part.id) }} />
                <span className="text-g-700">{part.label}</span>
                <span className="text-g-500 tabular-nums">{percents[index]}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-g-100 pt-3 text-label text-g-500">
        <span>{formatMoney(cash)} in cash to invest</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            track({ _tag: "add_cash_opened", entry: "home" })
            openCash("add")
          }}
        >
          <Icon name="plus" size={14} />Add cash
        </Button>
      </div>
    </MoneyCardFrame>
  )
}
