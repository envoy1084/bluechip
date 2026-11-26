import { useRender } from "@base-ui/react/use-render"
import {
  type ComponentProps,
  createContext,
  type CSSProperties,
  type MouseEvent,
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

/** The nearest sidebar's state: expanded or collapsed on desktop, the sheet's open state on phones. */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used inside a SidebarProvider.")
  return context
}

// Storage can be missing or blocked (private windows, previews); the sidebar then starts at its default.
const readStored = (key: string): boolean | undefined => {
  try {
    const stored = window.localStorage.getItem(key)
    return stored === "expanded" ? true : stored === "collapsed" ? false : undefined
  } catch {
    return undefined
  }
}

const STORED_EVENT = "bluechip:sidebar-stored"

const writeStored = (key: string, open: boolean) => {
  try {
    window.localStorage.setItem(key, open ? "expanded" : "collapsed")
  } catch {
    // Remembering is a convenience; the sidebar works without it.
  }
  window.dispatchEvent(new Event(STORED_EVENT))
}

const subscribeToStored = (onChange: () => void) => {
  window.addEventListener("storage", onChange)
  window.addEventListener(STORED_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(STORED_EVENT, onChange)
  }
}

export interface SidebarProviderProps extends ComponentProps<"div"> {
  readonly defaultOpen?: boolean
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  /** Remembers expanded or collapsed in this browser under this key. */
  readonly storageKey?: string
  /** ⌘B (or Ctrl+B) toggles this sidebar. Turn it off for a second sidebar, so the shortcut has one owner. */
  readonly shortcut?: boolean
}

/**
 * Holds a sidebar's state and lays it out beside its inset. Providers nest: a page can have its own sidebar inside
 * the app's inset, each with its own state.
 */
export function SidebarProvider(
  {
    defaultOpen = true,
    open: openProp,
    onOpenChange,
    storageKey,
    shortcut = true,
    className,
    style,
    children,
    ...props
  }: SidebarProviderProps
) {
  const isMobile = useSyncExternalStore(subscribeToMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false)
  const [openState, setOpenState] = useState(defaultOpen)
  const [openMobile, setOpenMobile] = useState(false)
  // The server has no storage, so it renders the default and hydration then picks up what was remembered.
  const stored = useSyncExternalStore(
    subscribeToStored,
    () => (storageKey === undefined ? undefined : readStored(storageKey)),
    () => undefined
  )
  const open = openProp ?? stored ?? openState

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    if (storageKey !== undefined) writeStored(storageKey, next)
    onOpenChange?.(next)
  }, [onOpenChange, storageKey])
  const toggleSidebar = useCallback(
    () => (isMobile ? setOpenMobile(!openMobile) : setOpen(!open)),
    [isMobile, openMobile, open, setOpen]
  )

  useEffect(() => {
    if (!shortcut) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "b") return
      event.preventDefault()
      toggleSidebar()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [shortcut, toggleSidebar])

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
        style={{ "--sidebar-width": "232px", "--sidebar-width-icon": "56px", ...style } as CSSProperties}
        className={cn("group/sidebar flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext>
  )
}

export interface SidebarProps extends ComponentProps<"aside"> {
  /** `icon` folds it to an icon rail with tooltips, `offcanvas` slides it away, `none` keeps it open. */
  readonly collapsible?: "icon" | "offcanvas" | "none"
  /** The edge it sits on; on phones, the side its sheet slides from. */
  readonly side?: "left" | "right"
  /** Its accessible name, and the sheet's on phones. */
  readonly label?: string
}

/** A sidebar of navigation. On desktop it collapses as `collapsible` says; on phones it becomes a sheet. */
export function Sidebar(
  { collapsible = "icon", side = "left", label = "App navigation", className, children, ...props }: SidebarProps
) {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar()
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side={side} data-slot="sidebar" className="w-[min(280px,86vw)] gap-3.5 bg-canvas px-2.5 py-3.5">
          <SheetTitle className="sr-only">{label}</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  const collapsed = collapsible !== "none" && state === "collapsed"
  return (
    <aside
      data-slot="sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      data-collapsible={collapsed ? collapsible : undefined}
      data-side={side}
      aria-label={label}
      className={cn(
        "group/sidebar-panel sticky top-0 flex h-svh w-(--sidebar-width) shrink-0 flex-col gap-3.5 bg-canvas px-2.5 py-3.5",
        side === "left" ? "border-r border-ink/6" : "order-last border-l border-ink/6",
        "transition-[width,padding] duration-slow ease-brand",
        "data-[collapsible=icon]:w-(--sidebar-width-icon)",
        "data-[collapsible=offcanvas]:w-0 data-[collapsible=offcanvas]:overflow-hidden data-[collapsible=offcanvas]:border-0 data-[collapsible=offcanvas]:px-0",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

/**
 * A thin strip on the sidebar's edge that toggles it, as in shadcn's sidebar. Pointer only: the trigger and ⌘B are
 * the keyboard's and screen readers' ways, so it stays out of the tab order and the accessibility tree.
 */
export function SidebarRail({ className, ...props }: ComponentProps<"button">) {
  const { toggleSidebar, isMobile } = useSidebar()
  if (isMobile) return null
  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      aria-hidden
      tabIndex={-1}
      title="Toggle sidebar"
      onClick={toggleSidebar}
      className={cn(
        "absolute inset-y-0 z-20 w-3 cursor-ew-resize",
        "group-data-[side=left]/sidebar-panel:-right-1.5 group-data-[side=right]/sidebar-panel:-left-1.5",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors after:duration-fast",
        "hover:after:bg-blue/40",
        className
      )}
      {...props}
    />
  )
}

/** Text that fades out when the sidebar folds to icons. */
const collapsedHiddenClassName =
  "transition-opacity duration-base ease-brand group-data-[collapsible=icon]/sidebar-panel:pointer-events-none group-data-[collapsible=icon]/sidebar-panel:opacity-0"

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

export function SidebarSeparator({ className, ...props }: ComponentProps<"hr">) {
  return <hr data-slot="sidebar-separator" className={cn("mx-1.5 border-t border-ink/6", className)} {...props} />
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
  /** The current page: a translucent blue wash with a blue icon and label, `aria-current="page"`. */
  readonly isActive?: boolean
  /** Shown beside the button while the sidebar is folded to icons. */
  readonly tooltip?: ReactNode
}

/**
 * A navigation row: icon, then label in a `<span>`. Renders a `<button>`; pass `render` for a link. On phones,
 * following it closes the navigation sheet, so the page it opens isn't left behind it.
 */
export function SidebarMenuButton(
  { isActive = false, tooltip, className, render, onClick, ...props }: SidebarMenuButtonProps
) {
  const { state, isMobile, setOpenMobile } = useSidebar()
  const button = useRender({
    defaultTagName: "button",
    render,
    props: {
      ...(render ? {} : { type: "button" as const }),
      ...props,
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (isMobile) setOpenMobile(false)
      },
      "aria-current": isActive ? "page" : undefined,
      "data-slot": "sidebar-menu-button",
      "data-active": isActive || undefined,
      className: cn(
        "flex h-[34px] w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-left text-[13.5px] font-medium whitespace-nowrap text-g-600 no-underline outline-none",
        "transition-colors duration-fast ease-brand",
        "hover:bg-blue/[.06] hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue",
        "data-active:bg-blue/10 data-active:text-blue data-active:hover:bg-blue/[.13] data-active:[&>svg]:text-blue",
        "dark:hover:bg-blue/10 dark:data-active:bg-blue/20 dark:data-active:text-blue-hi dark:data-active:[&>svg]:text-blue-hi",
        "[&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-g-400 [&>svg]:transition-colors",
        "[&>span:last-child]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:transition-opacity [&>span]:duration-base",
        "group-data-[collapsible=icon]/sidebar-panel:px-[9px] group-data-[collapsible=icon]/sidebar-panel:[&>span]:opacity-0",
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

export interface SidebarTriggerProps extends ButtonProps {
  /** Its accessible name; name each trigger when a page has two sidebars. */
  readonly label?: string
}

export function SidebarTrigger({ onClick, label = "Toggle sidebar", ...props }: SidebarTriggerProps) {
  const { toggleSidebar, open, isMobile, openMobile } = useSidebar()
  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
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
