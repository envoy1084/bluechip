import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"

/**
 * The head of a part of a page, the same size everywhere: its title (named by `id`, for the section's
 * `aria-labelledby`), one line on what it holds, and its actions on the right.
 */
export function SectionHeader(
  { id, title, description, actions, level = "h2", className }: Readonly<{
    id: string
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
    /** The heading's level: `h2` under the page's title, `h3` inside a tab or another section. */
    level?: "h2" | "h3"
    className?: string
  }>
) {
  const Heading = level

  return (
    <div className={cn("flex min-h-8 flex-wrap items-end justify-between gap-x-4 gap-y-2.5 px-0.5", className)}>
      <div className="grid min-w-0 gap-0.5">
        <Heading id={id} className="text-[16px] font-semibold tracking-[-0.015em] text-ink">{title}</Heading>
        {description === undefined ? null : <p className="text-label-sm text-g-500">{description}</p>}
      </div>
      {actions === undefined ? null : <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  )
}
