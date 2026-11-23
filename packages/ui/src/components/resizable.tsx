import type { ComponentProps } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"
import { cn } from "../lib/cn.ts"

/**
 * Panels split by handles you drag, or move with the arrow keys (5% a press, Home and End for the limits, F6 to the
 * next handle). Size panels with `defaultSize`, `minSize` and `maxSize` as percentages (`"34%"`).
 */
export function ResizablePanelGroup({ className, ...props }: ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full min-h-0", className)}
      {...props}
    />
  )
}

export function ResizablePanel({ className, ...props }: ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" className={cn("min-h-0 min-w-0", className)} {...props} />
}

export interface ResizableHandleProps extends ComponentProps<typeof Separator> {
  /** Shows the grip in the middle of the line. */
  readonly withHandle?: boolean
}

// The library sets `data-separator` to `inactive`, `hover`, `focus`, `active` or `disabled`, and `aria-orientation`
// across the split: a side-by-side group's handle is vertical.
export function ResizableHandle({ withHandle = true, className, ...props }: ResizableHandleProps) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "group/handle relative flex flex-none items-center justify-center bg-g-100 outline-none transition-colors duration-fast ease-brand",
        "data-[separator=active]:bg-blue data-[separator=focus]:bg-blue data-[separator=hover]:bg-blue",
        "before:absolute before:-inset-1.5 before:content-['']",
        "aria-[orientation=vertical]:w-px aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full",
        className
      )}
      {...props}
    >
      {withHandle && (
        <i
          aria-hidden
          className={cn(
            "relative z-1 shrink-0 rounded-[4px] bg-white shadow-e2 ring-1 ring-g-200 transition-shadow duration-fast ease-brand",
            "group-data-[separator=focus]/handle:ring-2 group-data-[separator=focus]/handle:ring-blue",
            "group-aria-[orientation=vertical]/handle:h-[26px] group-aria-[orientation=vertical]/handle:w-2",
            "group-aria-[orientation=horizontal]/handle:h-2 group-aria-[orientation=horizontal]/handle:w-[26px]"
          )}
        />
      )}
    </Separator>
  )
}
