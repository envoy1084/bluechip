import type { ComponentProps, ReactNode } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

export interface WorstCaseCardProps extends Omit<ComponentProps<"section">, "title"> {
  /** Defaults to "The worst case". */
  readonly title?: ReactNode
  /** The sentence: "On its worst day it could make 12 trades of up to $100 each, …". */
  readonly children: ReactNode
}

/** The most an agent could do on its worst day, from its rules, said before you lock them. */
export function WorstCaseCard({ title = "The worst case", children, className, ...props }: WorstCaseCardProps) {
  return (
    <section
      data-slot="worst-case-card"
      aria-label="The worst case"
      className={cn(
        "grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-lg bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] p-4 shadow-[var(--shadow-e2),0_0_0_1px_var(--color-info-line)]",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-[10px] bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"
      >
        <Icon name="shield" size={18} />
      </span>
      <div className="grid gap-1">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="text-body-sm text-g-700 [&_b]:font-semibold [&_b]:text-ink">{children}</p>
      </div>
    </section>
  )
}
