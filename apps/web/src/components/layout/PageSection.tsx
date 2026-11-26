import { cn } from "@bluechip/ui/lib/cn"
import { type ReactNode, useId } from "react"
import { SectionHeader } from "./SectionHeader.tsx"

/** A titled part of a page, its heading naming the region, with a line on what it holds and its links on the right. */
export function PageSection(
  { title, description, actions, level, className, children }: Readonly<{
    title: string
    description?: ReactNode
    actions?: ReactNode
    level?: "h2" | "h3"
    className?: string
    children: ReactNode
  }>
) {
  const id = useId()

  return (
    <section aria-labelledby={id} className={cn("grid min-w-0 content-start gap-3", className)}>
      <SectionHeader
        id={id}
        title={title}
        {...(description === undefined ? {} : { description })}
        {...(actions === undefined ? {} : { actions })}
        {...(level === undefined ? {} : { level })}
      />
      {children}
    </section>
  )
}
