import { formatMarketTime } from "@bluechip/ui/lib/format"
import { Halftone } from "@bluechip/ui/motion/halftone"
import * as DateTime from "effect/DateTime"
import { useMarketStatus } from "../../../../market/marketState.ts"

/**
 * While prices are paused (weekends, holidays): night clouds, when they move again, and that the tokens still trade,
 * so a still price doesn't read as a broken one.
 */
export function PricesPausedBanner() {
  const status = useMarketStatus()
  if (status?.session !== "paused") return null

  return (
    <div className="relative h-[150px] overflow-hidden rounded-xl bg-[linear-gradient(180deg,#f3f4ff,#fff)] shadow-e1 max-sm:h-[130px] max-sm:rounded-lg">
      <Halftone scene="clouds" className="absolute inset-0 size-full" />
      <output className="absolute right-4 bottom-3.5 left-4 grid max-w-[460px] gap-0.5 rounded-[12px] bg-white/88 px-3.5 py-2.5 shadow-e2 backdrop-blur-sm">
        <b className="text-body-sm font-semibold">
          Prices are paused for the {status.pausedFor === "holiday" ? "holiday" : "weekend"}
        </b>
        <span className="text-label text-g-600">
          Stock tokens still trade, with no live price to compare against. Prices move again{" "}
          {formatMarketTime(DateTime.toDateUtc(status.changesAt))}.
        </span>
      </output>
    </div>
  )
}
