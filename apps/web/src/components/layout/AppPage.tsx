import { LogoMark } from "@bluechip/ui/bluechip/logo"
import { SidebarTrigger } from "@bluechip/ui/components/sidebar"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import { ConnectionBanner } from "./ConnectionBanner.tsx"
import { useFrameActions } from "./FrameActions.tsx"

/**
 * A signed-in page: the top bar with its icon, title and actions (then the frame's own, the notifications bell), then
 * the page body with the connection banner.
 */
export function AppPage(
  { title, sub, icon, actions, children, width = "default" }: Readonly<{
    title: string
    /** Beside the title, like a company's logo. */
    icon?: ReactNode
    sub?: ReactNode
    actions?: ReactNode
    children: ReactNode
    width?: "default" | "wide"
  }>
) {
  const frameActions = useFrameActions()
  return (
    <>
      <header className="sticky top-0 z-10 flex min-h-[60px] items-center justify-between gap-3 border-b border-ink/6 bg-canvas/90 px-4 py-2.5 backdrop-blur md:px-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <SidebarTrigger className="-ml-1.5" />
          <LogoMark className="md:hidden" />
          {icon}
          <div className="grid min-w-0">
            <h1 className="text-[17px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
            {sub === undefined ? null : <span className="text-label-sm text-g-500">{sub}</span>}
          </div>
        </div>
        {actions === undefined && frameActions === null ?
          null :
          <div className="flex shrink-0 items-center gap-1.5">{actions}{frameActions}</div>}
      </header>
      <div className="grid flex-1 content-start px-4 pt-[18px] pb-7 md:px-8 md:pt-7 md:pb-14">
        <div className={cn("mx-auto grid w-full gap-[18px]", width === "wide" ? "max-w-[1040px]" : "max-w-[760px]")}>
          <ConnectionBanner />
          {children}
        </div>
      </div>
    </>
  )
}
