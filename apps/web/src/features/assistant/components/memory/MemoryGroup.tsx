import { cn } from "@bluechip/ui/lib/cn"
import { type ReactNode, useId } from "react"

/**
 * A titled group of memories on one card: the guesses to confirm stand out in amber with what they wait for, the
 * kinds sit plain with their count.
 */
export function MemoryGroup(
  { title, count, description, tone = "plain", children }: Readonly<{
    title: string
    count: number
    description?: string
    tone?: "plain" | "confirm"
    children: ReactNode
  }>
) {
  const heading = useId()

  return (
    <section
      aria-labelledby={heading}
      className={cn(
        "overflow-hidden rounded-lg bg-white shadow-e2",
        tone === "confirm" && "shadow-[0_0_0_1px_var(--color-warn-line),0_1px_2px_rgba(10,11,13,.04)]"
      )}
    >
      <header
        className={cn(
          "grid gap-0.5 border-b px-5 py-3",
          tone === "confirm" ? "border-warn-line bg-warn-wash" : "border-g-100"
        )}
      >
        <h2 id={heading} className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.01em]">
          {title}
          <span
            className={cn(
              "rounded-full px-1.5 text-[11.5px] leading-[18px] font-semibold tabular-nums",
              tone === "confirm" ? "bg-white text-warn" : "bg-g-100 text-g-600"
            )}
          >
            {count}
          </span>
        </h2>
        {description === undefined ?
          null :
          <p className={cn("text-label-sm", tone === "confirm" ? "text-warn" : "text-g-500")}>{description}</p>}
      </header>
      <ul>{children}</ul>
    </section>
  )
}
