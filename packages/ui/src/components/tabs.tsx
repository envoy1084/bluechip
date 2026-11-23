import { Tabs as BaseTabs } from "@base-ui/react/tabs"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export interface TabsProps extends BaseTabs.Root.Props {
  /** `underline` for page-level views, `segmented` for a compact switch inside a card. */
  readonly variant?: "underline" | "segmented"
}

/** Switch between views of the same thing. Arrow keys move and select, Home and End jump. */
export function Tabs({ variant = "underline", className, ...props }: TabsProps) {
  return (
    <BaseTabs.Root
      data-slot="tabs"
      data-variant={variant}
      className={cn("group/tabs grid w-full min-w-0 gap-4", className)}
      {...props}
    />
  )
}

export function TabsList({ className, children, activateOnFocus = true, ...props }: BaseTabs.List.Props) {
  return (
    <BaseTabs.List
      data-slot="tabs-list"
      activateOnFocus={activateOnFocus}
      className={cn(
        "relative flex overflow-x-auto [scrollbar-width:none]",
        "group-data-[variant=underline]/tabs:gap-[22px] group-data-[variant=underline]/tabs:shadow-[inset_0_-1px_0_var(--color-g-200)]",
        "group-data-[variant=segmented]/tabs:w-fit group-data-[variant=segmented]/tabs:max-w-full group-data-[variant=segmented]/tabs:rounded-[11px] group-data-[variant=segmented]/tabs:bg-g-100 group-data-[variant=segmented]/tabs:p-[3px] group-data-[variant=segmented]/tabs:shadow-[inset_0_0_0_1px_rgba(10,11,13,.04)]",
        className
      )}
      {...props}
    >
      {children}
      <BaseTabs.Indicator
        data-slot="tabs-indicator"
        className={cn(
          "absolute left-0 w-(--active-tab-width) translate-x-(--active-tab-left) transition-[translate,width] duration-base ease-brand",
          "group-data-[variant=underline]/tabs:bottom-0 group-data-[variant=underline]/tabs:h-0.5 group-data-[variant=underline]/tabs:rounded-full group-data-[variant=underline]/tabs:bg-blue",
          "group-data-[variant=segmented]/tabs:top-[3px] group-data-[variant=segmented]/tabs:bottom-[3px] group-data-[variant=segmented]/tabs:rounded-[8px] group-data-[variant=segmented]/tabs:bg-[linear-gradient(180deg,#fff,#f9fafb)]",
          "group-data-[variant=segmented]/tabs:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.08),0_1px_3px_rgba(10,11,13,.1)]"
        )}
      />
    </BaseTabs.List>
  )
}

export function TabsTab({ className, ...props }: BaseTabs.Tab.Props) {
  return (
    <BaseTabs.Tab
      data-slot="tabs-tab"
      className={cn(
        "relative z-1 inline-flex cursor-pointer items-center gap-[7px] font-[550] whitespace-nowrap text-g-500 outline-none",
        "transition-colors duration-fast ease-brand hover:text-ink data-active:text-ink",
        "data-disabled:cursor-not-allowed data-disabled:opacity-40 data-disabled:hover:text-g-500",
        "focus-visible:rounded-[8px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue",
        "group-data-[variant=underline]/tabs:h-10 group-data-[variant=underline]/tabs:px-0.5 group-data-[variant=underline]/tabs:text-body-sm",
        "group-data-[variant=segmented]/tabs:h-[30px] group-data-[variant=segmented]/tabs:rounded-[8px] group-data-[variant=segmented]/tabs:px-3.5 group-data-[variant=segmented]/tabs:text-[13.5px]",
        className
      )}
      {...props}
    />
  )
}

/** A small count after a tab's label, such as unread activity. */
export function TabsCount({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="tabs-count"
      className={cn(
        "rounded-full bg-g-100 px-1.5 text-[11.5px] leading-[18px] font-semibold text-g-600 tabular-nums",
        className
      )}
      {...props}
    />
  )
}

export function TabsPanel({ className, ...props }: BaseTabs.Panel.Props) {
  return (
    <BaseTabs.Panel
      data-slot="tabs-panel"
      className={cn(
        "text-body-sm outline-none focus-visible:rounded-[6px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue",
        className
      )}
      {...props}
    />
  )
}
