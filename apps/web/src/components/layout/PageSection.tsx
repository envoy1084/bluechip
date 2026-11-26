import { cn } from "@bluechip/ui/lib/cn"
import { type ReactNode, useId } from "react"

/** A titled part of a page, its heading naming the region, with its links on the right. */
export function PageSection(
  { title, actions, className, children }: Readonly<{
    title: string
    actions?: ReactNode
    className?: string
    children: ReactNode
  }>
) {
  const id = useId()

  return (
    <section aria-labelledby={id} className={cn("grid min-w-0 content-start gap-2.5", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id={id} className="text-body-sm font-semibold tracking-[-0.01em]">{title}</h2>
        {actions === undefined ? null : <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
