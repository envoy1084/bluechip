import { cva } from "class-variance-authority"
import type { ComponentProps, ReactNode } from "react"
import { TextMorph } from "../components/text-morph.tsx"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

/**
 * What a state means for you, as a pill's color: done (`positive`), on its way or waiting (`pending`), worth a look
 * (`attention`), didn't happen (`negative`), over or quiet (`neutral`), and a plain fact (`info`).
 */
export type StatusTone = "positive" | "pending" | "attention" | "negative" | "neutral" | "info"

export const statusPillVariants = cva(
  "inline-flex h-[22px] w-fit shrink-0 items-center gap-1 rounded-full px-2 text-caption font-semibold whitespace-nowrap [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        positive: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]",
        pending: "bg-info-wash text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]",
        attention: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]",
        negative: "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]",
        neutral: "bg-g-50 text-g-600 shadow-[inset_0_0_0_1px_var(--color-g-200)]",
        info: "bg-white text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-200)]"
      }
    },
    defaultVariants: { tone: "neutral" }
  }
)

export interface StatusPillProps extends Omit<ComponentProps<"span">, "children"> {
  readonly tone: StatusTone
  /** The state in a word or two. */
  readonly children: ReactNode
  /** An icon before the label, so the state reads without color too. */
  readonly icon?: IconName
  /** A dot before the label; `live` makes it breathe (still under reduced motion), for something watching now. */
  readonly dot?: boolean | "live"
  /** Morph the label in place when it changes, for a state that moves while you watch. */
  readonly morph?: boolean
}

/** A short state in a pill, the same size and shape everywhere: a trade's, an agent's, an automation's. */
export function StatusPill(
  { tone, icon, dot = false, morph = false, className, children, ...props }: StatusPillProps
) {
  return (
    <span
      data-slot="status-pill"
      data-tone={tone}
      className={cn(statusPillVariants({ tone }), className)}
      {...props}
    >
      {icon === undefined ? null : <Icon name={icon} size={12} />}
      {dot === false || icon !== undefined ? null : dot === "live" ?
        (
          <span aria-hidden className="relative grid size-1.5 place-items-center">
            <i className="absolute inset-0 rounded-full bg-current opacity-60 motion-safe:animate-ping" />
            <i className="size-1.5 rounded-full bg-current" />
          </span>
        ) :
        <i aria-hidden className="size-1.5 rounded-full bg-current" />}
      {morph ? <TextMorph>{children}</TextMorph> : children}
    </span>
  )
}
