import { cn } from "@bluechip/ui/lib/cn"

const TONE = {
  done: "bg-gain-wash text-gain",
  waiting: "bg-blue-50 text-blue",
  quiet: "bg-g-100 text-g-600",
  warn: "bg-warn-wash text-warn"
} as const

/** A short state in a pill: an automation's ("Active", "Paused") or a run's ("Traded", "Skipped"). */
export function StatusPill(
  { label, tone, className }: Readonly<{ label: string; tone: keyof typeof TONE; className?: string }>
) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap",
        TONE[tone],
        className
      )}
    >
      {label}
    </span>
  )
}
