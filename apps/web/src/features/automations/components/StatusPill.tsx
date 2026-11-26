import { cn } from "@bluechip/ui/lib/cn"
import { STANDING, type Standing } from "../model/standing.ts"

const TONE = {
  done: "bg-gain-wash text-gain",
  waiting: "bg-blue-50 text-blue",
  quiet: "bg-g-100 text-g-600",
  warn: "bg-warn-wash text-warn"
} as const

/**
 * A short state in a pill: an automation's ("Active", "Paused") or a run's ("Traded", "Skipped"). `live` adds a dot
 * that breathes while it watches (still under reduced motion).
 */
export function StatusPill(
  { label, tone, live = false, className }: Readonly<{
    label: string
    tone: keyof typeof TONE
    live?: boolean
    className?: string
  }>
) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap",
        TONE[tone],
        className
      )}
    >
      {live ?
        (
          <span aria-hidden className="relative grid size-1.5 place-items-center">
            <i className="absolute inset-0 rounded-full bg-current opacity-60 motion-safe:animate-ping" />
            <i className="size-1.5 rounded-full bg-current" />
          </span>
        ) :
        null}
      {label}
    </span>
  )
}

/** Where an automation stands, as a pill; a running one breathes. */
export function StandingPill({ standing, className }: Readonly<{ standing: Standing; className?: string }>) {
  const { label, tone } = STANDING[standing]
  return <StatusPill label={label} tone={tone} live={standing === "active"} {...(className ? { className } : {})} />
}
