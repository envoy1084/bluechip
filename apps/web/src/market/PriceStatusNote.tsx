import type { PriceStatus } from "@bluechip/domain/market/Market"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAfterHours } from "./marketState.ts"

/**
 * Where a price stands: trading now, moving after hours (the feeds run 24/5), the last close (weekends, holidays),
 * or a feed that stopped updating.
 */
export function PriceStatusNote({ status }: Readonly<{ status: PriceStatus }>) {
  const afterHours = useAfterHours()
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-[5px] text-caption text-g-500">
        <i
          aria-hidden
          className={afterHours ?
            "size-1.5 rounded-full bg-blue shadow-[0_0_0_2.5px_rgba(42,91,255,.18)]" :
            "size-1.5 rounded-full bg-green shadow-[0_0_0_2.5px_rgba(102,200,0,.2)]"}
        />
        {afterHours ? "After hours" : "Trading now"}
      </span>
    )
  }
  const stale = status === "stale"
  return (
    <span className={`inline-flex items-center gap-[5px] text-caption ${stale ? "text-warn" : "text-g-500"}`}>
      <Icon name={stale ? "warning" : "moon"} size={12} />
      {stale ? "Price not updating" : "Last close"}
    </span>
  )
}
