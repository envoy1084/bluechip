import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export interface ScrollAreaProps extends ComponentProps<typeof BaseScrollArea.Root> {
  /** Which scrollbars to show. */
  readonly orientation?: "vertical" | "horizontal" | "both"
}

/**
 * A scrolling region with a slim, quiet scrollbar that still works with keyboard, wheel and touch. Give it a
 * height (or width) and an `aria-label` when its content is a meaningful region.
 */
export function ScrollArea({
  orientation = "vertical",
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root data-slot="scroll-area" className={cn("relative overflow-hidden", className)} {...props}>
      <BaseScrollArea.Viewport
        data-slot="scroll-area-viewport"
        aria-label={ariaLabel}
        {...(ariaLabel ? { role: "region" } : {})}
        className="size-full overscroll-contain rounded-[inherit] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-blue)]"
      >
        {children}
      </BaseScrollArea.Viewport>
      {orientation !== "horizontal" && <ScrollBar orientation="vertical" />}
      {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
      <BaseScrollArea.Corner />
    </BaseScrollArea.Root>
  )
}

function ScrollBar({ orientation }: { readonly orientation: "vertical" | "horizontal" }) {
  return (
    <BaseScrollArea.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-[3px] opacity-0 transition-opacity duration-base ease-brand select-none data-hovering:opacity-100 data-scrolling:opacity-100 data-scrolling:duration-0",
        orientation === "vertical" ? "w-2.5" : "h-2.5 flex-col"
      )}
    >
      <BaseScrollArea.Thumb className="flex-1 rounded-full bg-g-200 hover:bg-g-300" />
    </BaseScrollArea.Scrollbar>
  )
}
