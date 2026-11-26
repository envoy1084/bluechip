import type { Trigger } from "@bluechip/domain/automations/Automation"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"

// One quiet wash for every tile: the illustrations carry the color.
const WASH = "bg-[linear-gradient(180deg,#f8f9fb,#eef0f3)]"

/** Each trigger's illustration. */
const TRIGGER_ART: Readonly<Record<Trigger["type"], IllustrationName>> = {
  schedule: "calendar",
  priceMove: "price-move",
  priceCross: "price-level",
  drift: "target",
  portfolio: "pie",
  news: "newspaper"
}

/**
 * What starts an automation, as its illustration on a tile: pixel art for lists (`md`, 48 px), or a halftone that
 * drifts (still under reduced motion) for its page (`hero`). Decorative: the sentence beside it says the trigger.
 */
export function TriggerArt(
  { type, size = "md", dimmed = false, className }: Readonly<{
    type: Trigger["type"]
    size?: "md" | "hero"
    dimmed?: boolean
    className?: string
  }>
) {
  const illustration = TRIGGER_ART[type]

  if (size === "hero") {
    return (
      <div
        aria-hidden
        className={cn(
          "grid size-[176px] shrink-0 place-items-center rounded-[22px] shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]",
          WASH,
          dimmed && "grayscale-[.85]",
          className
        )}
      >
        <Illustration name={illustration} variant="halftone" size={160} animate={!dimmed} label="" />
      </div>
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-[13px] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.06)]",
        WASH,
        dimmed && "grayscale-[.85] opacity-70",
        className
      )}
    >
      <Illustration name={illustration} size={40} label="" />
    </span>
  )
}
