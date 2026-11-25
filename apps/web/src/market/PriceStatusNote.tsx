import type { PriceStatus } from "@bluechip/domain/market/Market"
import { Icon } from "@bluechip/ui/icons/icon"

const NOTE: Readonly<Record<Exclude<PriceStatus, "live">, { label: string; className: string }>> = {
  closed: { label: "Last close", className: "text-g-500" },
  stale: { label: "Stale", className: "text-warn" }
}

/** Says when a price is not live: the market's last close, or a feed that stopped updating. Live prices say nothing. */
export function PriceStatusNote({ status }: Readonly<{ status: PriceStatus }>) {
  if (status === "live") return null
  const { label, className } = NOTE[status]
  return (
    <span className={`inline-flex items-center gap-1 text-caption font-medium ${className}`}>
      <Icon name={status === "stale" ? "warning" : "moon"} size={12} />
      {label}
    </span>
  )
}
