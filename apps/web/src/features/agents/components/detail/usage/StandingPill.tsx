import { cn } from "@bluechip/ui/lib/cn"
import type { Standing } from "../../../model/usage.ts"

const PILL: Readonly<Record<Exclude<Standing, "open">, { readonly label: string; readonly tone: string }>> = {
  room: { label: "Room left", tone: "bg-gain-wash text-gain" },
  nearly: { label: "Nearly used", tone: "bg-warn-wash text-warn" },
  used: { label: "Used up", tone: "bg-loss-wash text-loss" }
}

/** How a limit stands, as a pill; a limit without a cap shows `open` instead, or nothing. */
export function StandingPill(
  { standing, open, className }: Readonly<{ standing: Standing; open?: string; className?: string }>
) {
  const pill = standing === "open" ?
    open === undefined ? null : { label: open, tone: "bg-g-100 text-g-700" } :
    PILL[standing]
  if (pill === null) return null

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap",
        pill.tone,
        className
      )}
    >
      {pill.label}
    </span>
  )
}
