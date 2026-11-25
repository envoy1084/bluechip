import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { formatMoney } from "@bluechip/ui/lib/format"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { portfolioHistoryAtom } from "../../../atoms/portfolio.ts"
import { usdcDollars } from "../../../lib/amounts.ts"

/** Your money at a glance: total value and today's move, cash, agents and the past 30 days as a sparkline. */
export function BalanceCard({ portfolio }: Readonly<{ portfolio: Portfolio }>) {
  const history = useAtomValue(portfolioHistoryAtom)
  const values = AsyncResult.isSuccess(history) ? history.value.map((point) => usdcDollars(point.value)) : []

  const total = usdcDollars(portfolio.value)
  const change = usdcDollars(portfolio.change24h)
  const before = total - change

  return (
    <section className="flex flex-wrap items-end justify-between gap-x-7 gap-y-[18px] rounded-lg bg-white px-[22px] py-5 shadow-e2">
      <div className="grid gap-1.5">
        <span className="text-caption font-medium text-g-500">Total value</span>
        <NumberRoll
          value={total}
          format={formatMoney}
          className="text-[34px] leading-[1.1] font-semibold tracking-[-0.04em] max-sm:text-[30px]"
        />
        <span className="flex items-center gap-1.5">
          <PriceChange value={before === 0 ? 0 : (change / before) * 100} amount={change} />
          <span className="text-label-sm text-g-500">today</span>
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="grid gap-0.5">
          <span className="text-caption font-medium text-g-500">Cash (USDC)</span>
          <b className="text-[14.5px] font-semibold tabular-nums">{formatMoney(usdcDollars(portfolio.cash))}</b>
        </div>
        <div className="grid gap-0.5">
          <span className="text-caption font-medium text-g-500">Agents</span>
          <b className="text-[14.5px] font-semibold">None yet</b>
        </div>
        {values.length >= 2 && (
          <Sparkline values={values} width={132} height={40} className="max-sm:hidden" label="Past 30 days" />
        )}
      </div>
    </section>
  )
}
