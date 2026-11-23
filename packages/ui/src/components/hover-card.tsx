import { PreviewCard } from "@base-ui/react/preview-card"
import { cn } from "../lib/cn.ts"
import { popMotionClassName } from "./popover.tsx"

/** A preview on hover or keyboard focus, for people who want a peek before they click. */
export function HoverCard(props: PreviewCard.Root.Props) {
  return <PreviewCard.Root {...props} />
}

/** A link that opens the card after 500 ms of hover and closes 250 ms after the pointer leaves. */
export function HoverCardTrigger({ delay = 500, closeDelay = 250, ...props }: PreviewCard.Trigger.Props) {
  return <PreviewCard.Trigger data-slot="hover-card-trigger" delay={delay} closeDelay={closeDelay} {...props} />
}

export interface HoverCardContentProps
  extends PreviewCard.Popup.Props, Pick<PreviewCard.Positioner.Props, "side" | "align" | "sideOffset">
{}

export function HoverCardContent(
  { className, side = "bottom", align = "start", sideOffset = 8, ...props }: HoverCardContentProps
) {
  return (
    <PreviewCard.Portal>
      <PreviewCard.Positioner side={side} align={align} sideOffset={sideOffset} collisionPadding={8} className="z-50">
        <PreviewCard.Popup
          data-slot="hover-card-content"
          className={cn(
            "grid w-80 max-w-[calc(100vw-16px)] gap-3.5 rounded-lg bg-white p-4 text-label shadow-e3 outline-none",
            popMotionClassName,
            className
          )}
          {...props}
        />
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  )
}
