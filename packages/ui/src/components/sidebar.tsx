import { useRender } from "@base-ui/react/use-render"
import {
  type ComponentProps,
  createContext,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button, type ButtonProps } from "./button.tsx"
import { Sheet, SheetContent, SheetTitle } from "./sheet.tsx"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.tsx"

const MOBILE_QUERY = "(max-width: 767px)"

const subscribeToMobile = (onChange: () => void) => {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

interface SidebarContextValue {
  readonly state: "expanded" | "collapsed"
  readonly open: boolean
  readonly setOpen: (open: boolean) => void
  readonly isMobile: boolean
  readonly openMobile: boolean
  readonly setOpenMobile: (open: boolean) => void
  readonly toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

/** The sidebar's state: expanded or collapsed on desktop, the sheet's open state on phones. */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used inside a SidebarProvider.")
  return context
}

export interface SidebarProviderProps extends ComponentProps<"div"> {
  readonly defaultOpen?: boolean
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
}

/** Holds the sidebar's state and lays out the sidebar beside its inset. ⌘B (or Ctrl+B) toggles it. */
export function SidebarProvider(
  { defaultOpen = true, open: openProp, onOpenChange, className, style, children, ...props }: SidebarProviderProps
) {
  const isMobile = useSyncExternalStore(subscribeToMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false)
  const [openState, setOpenState] = useState(defaultOpen)
  const [openMobile, setOpenMobile] = useState(false)
  const open = openProp ?? openState
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }, [onOpenChange])
  const toggleSidebar = useCallback(
    () => (isMobile ? setOpenMobile(!openMobile) : setOpen(!open)),
    [isMobile, openMobile, open, setOpen]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "b") return
      event.preventDefault()
      toggleSidebar()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggleSidebar])

  const state = open ? "expanded" : "collapsed"
  const context = useMemo(
    () => ({ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }) as const,
    [state, open, setOpen, isMobile, openMobile, toggleSidebar]
  )
  return (
    <SidebarContext value={context}>
      <div
        data-slot="sidebar-wrapper"
        data-state={state}
        style={{ "--sidebar-width": "216px", "--sidebar-width-icon": "60px", ...style } as CSSProperties}
        className={cn("group/sidebar flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext>
  )
}

export interface SidebarProps extends ComponentProps<"aside"> {
  /** `icon` folds it to an icon rail with tooltips; `none` keeps it open. */
  readonly collapsible?: "icon" | "none"
  /** The sheet's accessible name on phones. */
  readonly label?: string
}

/** The app's main navigation. On phones it becomes a sheet from the left. */
export function Sidebar(
  { collapsible = "icon", label = "App navigation", className, children, ...props }: SidebarProps
) {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar()
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="left" data-slot="sidebar" className="w-[min(280px,86vw)] gap-3.5 bg-g-50 px-2.5 py-3.5">
          <SheetTitle className="sr-only">{label}</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <aside
      data-slot="sidebar"
      data-state={collapsible === "none" ? "expanded" : state}
      aria-label={label}
      className={cn(
        "group/sidebar-panel flex w-(--sidebar-width) shrink-0 flex-col gap-3.5 overflow-hidden border-r border-ink/6 bg-[#fafafb] px-2.5 py-3.5",
        "transition-[width] duration-slow ease-brand data-[state=collapsed]:w-(--sidebar-width-icon)",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

/** Text that fades out when the sidebar folds to icons. */
const collapsedHiddenClassName =
  "transition-opacity duration-base ease-brand group-data-[state=collapsed]/sidebar-panel:pointer-events-none group-data-[state=collapsed]/sidebar-panel:opacity-0"

export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex h-7 items-center gap-2 px-1.5 whitespace-nowrap", className)}
      {...props}
    />
  )
}

export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col gap-3.5 overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  )
}

export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("mt-auto flex flex-col gap-px", className)} {...props} />
}

export function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sidebar-group" className={cn("flex flex-col gap-px", className)} {...props} />
}

export function SidebarGroupLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "h-[18px] px-2.5 pb-1 text-caption-sm font-semibold whitespace-nowrap text-g-400",
        collapsedHiddenClassName,
        className
      )}
      {...props}
    />
  )
}

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex flex-col gap-px", className)} {...props} />
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("relative", className)} {...props} />
}

export interface SidebarMenuButtonProps extends useRender.ComponentProps<"button"> {
  /** The current page: white, raised, blue icon, `aria-current="page"`. */
  readonly isActive?: boolean
  /** Shown beside the button while the sidebar is folded to icons. */
  readonly tooltip?: ReactNode
}

/** A navigation row: icon, then label in a `<span>`. Renders a `<button>`; pass `render` for a link. */
export function SidebarMenuButton({ isActive = false, tooltip, className, render, ...props }: SidebarMenuButtonProps) {
  const { state, isMobile } = useSidebar()
  const button = useRender({
    defaultTagName: "button",
    render,
    props: {
      ...(render ? {} : { type: "button" as const }),
      ...props,
      "aria-current": isActive ? "page" : undefined,
      "data-slot": "sidebar-menu-button",
      "data-active": isActive || undefined,
      className: cn(
        "flex h-[34px] w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-left text-[13.5px] font-medium whitespace-nowrap text-g-600 no-underline outline-none",
        "hover:bg-g-100 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue",
        "data-active:bg-white data-active:text-ink data-active:shadow-e1 data-active:[&>svg]:text-blue",
        "[&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-g-400",
        "[&>span:last-child]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:transition-opacity [&>span]:duration-base",
        "group-data-[state=collapsed]/sidebar-panel:px-[9px] group-data-[state=collapsed]/sidebar-panel:[&>span]:opacity-0",
        className
      )
    }
  })
  if (tooltip == null) return button
  return (
    <Tooltip disabled={state !== "collapsed" || isMobile}>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

/** A count at the end of a row, such as approvals waiting. */
export function SidebarMenuBadge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-menu-badge"
      className={cn(
        "pointer-events-none absolute top-1/2 right-2 grid h-[18px] min-w-[18px] -translate-y-1/2 place-items-center rounded-full bg-blue px-[5px] text-caption-sm font-semibold text-white tabular-nums",
        collapsedHiddenClassName,
        className
      )}
      {...props}
    />
  )
}

export function SidebarTrigger({ onClick, ...props }: ButtonProps) {
  const { toggleSidebar, open, isMobile, openMobile } = useSidebar()
  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle sidebar"
      aria-expanded={isMobile ? openMobile : open}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <Icon name="sidebar" size={18} />
    </Button>
  )
}

/** The page area beside the sidebar. */
export function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return <main data-slot="sidebar-inset" className={cn("flex min-w-0 flex-1 flex-col", className)} {...props} />
}
