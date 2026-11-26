import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import type { ReactNode } from "react"

/**
 * Nothing here yet (or nothing found), said with one of bluechip's illustrations in moving halftone (still under
 * reduced motion), what will appear and, when there is one, the way to start. `variant` and `size` are `Empty`'s:
 * `plain` inside another surface, `outline` for a slot waiting to fill, `sm` in a popover or a list.
 */
export function IllustratedEmpty(
  { illustration, title, children, action, size = 140, variant = "default", compact = false, className }: Readonly<{
    illustration: IllustrationName
    title: string
    children: ReactNode
    action?: ReactNode
    /** The illustration's size in pixels. */
    size?: number
    variant?: "default" | "outline" | "plain"
    compact?: boolean
    className?: string
  }>
) {
  return (
    <Empty variant={variant} size={compact ? "sm" : "md"} className={className}>
      <Illustration name={illustration} variant="halftone" size={size} animate className="-my-2" />
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{children}</EmptyDescription>
      {action === undefined ?
        null :
        <EmptyContent className="flex flex-wrap justify-center gap-2">{action}</EmptyContent>}
    </Empty>
  )
}
