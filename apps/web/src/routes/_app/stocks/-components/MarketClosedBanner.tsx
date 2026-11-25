import { formatMarketTime } from "@bluechip/ui/lib/format"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { marketStatusAtom } from "../../../../atoms/market.ts"

/** While the US market is shut: night clouds and when it opens, so a still price doesn't read as a broken one. */
export function MarketClosedBanner() {
  const status = useAtomValue(marketStatusAtom)
  if (!AsyncResult.isSuccess(status) || status.value.state === "open") return null
  const { opensAt, reason } = status.value
  const paused = reason === "weekend" || reason === "holiday"
  return (
    <div className="relative h-[150px] overflow-hidden rounded-xl bg-[linear-gradient(180deg,#f3f4ff,#fff)] shadow-e1 max-sm:h-[130px] max-sm:rounded-lg">
      <Halftone scene="clouds" className="absolute inset-0 size-full" />
      <output className="absolute right-4 bottom-3.5 left-4 grid max-w-[420px] gap-0.5 rounded-[12px] bg-white/88 px-3.5 py-2.5 shadow-e2 backdrop-blur-sm">
        <b className="text-body-sm font-semibold">The US market is closed</b>
        <span className="text-label text-g-600">
          {paused ? "Prices show the last close." : "Prices keep updating after hours."}
          {opensAt === null ? null : ` It opens ${formatMarketTime(DateTime.toDateUtc(opensAt))}.`}
        </span>
      </output>
    </div>
  )
}
