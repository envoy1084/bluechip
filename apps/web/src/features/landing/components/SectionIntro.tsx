import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import { Reveal } from "./Reveal.tsx"

/** A landing section's kicker, heading and lead, revealed together. */
export function SectionIntro(
  { kicker, title, children, align = "start", className }: Readonly<{
    kicker: string
    title: ReactNode
    children?: ReactNode
    align?: "start" | "center"
    className?: string
  }>
) {
  return (
    <Reveal
      className={cn("grid gap-3.5", align === "center" && "justify-items-center text-center", className)}
    >
      <span className="inline-flex items-center gap-2 text-label font-semibold text-blue before:size-1.5 before:rounded-[1.5px] before:bg-blue">
        {kicker}
      </span>
      <h2 className="max-w-[18ch] text-[clamp(32px,4.6vw,52px)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">
        {title}
      </h2>
      {children === undefined ? null : <p className="max-w-[56ch] text-body-lg text-pretty text-g-600">{children}</p>}
    </Reveal>
  )
}
