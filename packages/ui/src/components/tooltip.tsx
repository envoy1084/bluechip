import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip"
import type { ReactNode } from "react"
import { cn } from "../lib/cn.ts"
import { Kbd } from "./kbd.tsx"

/** Shares the hover delay between tooltips: 450 ms for the first, none while one was just open. */
export function TooltipProvider({ delay = 450, ...props }: BaseTooltip.Provider.Props) {
  return <BaseTooltip.Provider delay={delay} {...props} />
}

/** A short text label for an icon-only control. Never put interactive content in it. */
export function Tooltip(props: BaseTooltip.Root.Props) {
  return <BaseTooltip.Root {...props} />
}

export function TooltipTrigger(props: BaseTooltip.Trigger.Props) {
  return <BaseTooltip.Trigger data-slot="tooltip-trigger" {...props} />
}

export interface TooltipContentProps
  extends BaseTooltip.Popup.Props, Pick<BaseTooltip.Positioner.Props, "side" | "align" | "sideOffset">
{
  /** A keyboard shortcut shown after the label, such as `⌘K`. */
  readonly shortcut?: ReactNode
}

export function TooltipContent(
  { className, side = "top", align = "center", sideOffset = 7, shortcut, children, ...props }: TooltipContentProps
) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className="z-[130]"
      >
        <BaseTooltip.Popup
          data-slot="tooltip-content"
          className={cn(
            "inline-flex max-w-[260px] items-center gap-1.5 rounded-[7px] bg-ink px-[9px] py-[5px] text-label-sm font-medium text-white",
            "shadow-[inset_0_0_0_1px_rgba(255,255,255,.06),0_3px_8px_-2px_rgba(10,11,13,.18)]",
            "transition-opacity duration-fast ease-brand data-starting-style:opacity-0 data-ending-style:opacity-0",
            "data-instant:transition-none",
            className
          )}
          {...props}
        >
          {children}
          {shortcut != null && (
            <Kbd variant="inverse" className="h-[18px] min-w-[18px] text-caption-sm">
              {shortcut}
            </Kbd>
          )}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}
