import type { ComponentProps, ReactNode } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

export interface WorstCaseCardProps extends Omit<ComponentProps<"section">, "title"> {
  /** Defaults to "The worst case". */
  readonly title?: ReactNode
  /** The sentence: "On its worst day it could make 12 trades of up to $100 each, …". */
  readonly children: ReactNode
  /** `quiet` for inside another card: a recessed panel with a grey shield instead of the blue one. */
  readonly tone?: "brand" | "quiet"
}

/** The most an agent could do on its worst day, from its rules, said before you lock them. */
export function WorstCaseCard(
  { title = "The worst case", tone = "brand", children, className, ...props }: WorstCaseCardProps
) {
  const quiet = tone === "quiet"
  return (
    <section
      data-slot="worst-case-card"
      aria-label="The worst case"
      data-tone={tone}
      className={cn(
        "grid items-start",
        quiet ?
          "grid-cols-[18px_minmax(0,1fr)] gap-2 rounded-[12px] px-3 py-2.5 surface-well" :
          "grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-lg bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] p-4 shadow-[var(--shadow-e2),0_0_0_1px_var(--color-info-line)]",
        className
      )}
      {...props}
    >
      {quiet ?
        <Icon name="shield" size={15} className="mt-0.5 text-g-500" /> :
        (
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-[10px] bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"
          >
            <Icon name="shield" size={18} />
          </span>
        )}
      <div className={quiet ? "grid gap-0.5" : "grid gap-1"}>
        <h3 className={quiet ? "text-[13px] font-semibold" : "text-[15px] font-semibold"}>{title}</h3>
        <p
          className={cn(
            "text-g-700 [&_b]:font-semibold [&_b]:text-ink",
            quiet ? "text-[13px] leading-normal" : "text-body-sm"
          )}
        >
          {children}
        </p>
      </div>
    </section>
  )
}
