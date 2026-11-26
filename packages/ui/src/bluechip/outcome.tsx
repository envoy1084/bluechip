import { type ComponentProps, type ReactNode, useEffect, useRef } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { EASE } from "../motion/easing.ts"
import { prefersReducedMotion } from "../motion/reduced-motion.ts"

/** How something you asked for ended: it went through, or it didn't and nothing moved. */
export type OutcomeTone = "success" | "failure"

export interface OutcomeMarkProps {
  readonly tone: OutcomeTone
  /** 40 inside a card or dialog, 56 on a page. */
  readonly size?: number
  readonly className?: string
}

/**
 * The round mark at the top of an end state: a check that draws itself in a green disc, or a cross in a red one.
 * The disc settles from 0.9 and the stroke draws once on mount; under reduced motion both are already there.
 */
export function OutcomeMark({ tone, size = 40, className }: OutcomeMarkProps) {
  const disc = useRef<HTMLSpanElement>(null)
  const stroke = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    disc.current?.animate(
      [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }],
      { duration: 300, easing: EASE.brand, fill: "backwards" }
    )
    stroke.current?.animate(
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: 360, delay: 120, easing: "ease-out", fill: "backwards" }
    )
  }, [])

  return (
    <span
      ref={disc}
      aria-hidden
      data-slot="outcome-mark"
      data-tone={tone}
      style={{ width: size, height: size }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full text-white",
        tone === "success" ?
          "bg-[linear-gradient(180deg,#23a463,var(--color-gain))] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_0_0_4px_var(--color-gain-wash),0_6px_14px_-6px_rgba(11,128,67,.4)]" :
          "bg-[linear-gradient(180deg,#e2492b,var(--color-loss))] shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_0_0_4px_var(--color-loss-wash),0_6px_14px_-6px_rgba(204,53,25,.4)]",
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" width={size * 0.5} height={size * 0.5}>
        <path
          ref={stroke}
          d={tone === "success" ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"}
          pathLength={1}
          strokeDasharray="1"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export interface OutcomeProps extends Omit<ComponentProps<"div">, "title"> {
  readonly tone: OutcomeTone
  /** What happened, as a sentence: "Bought $50 of Apple", "Nvidia wasn't sold". */
  readonly title: ReactNode
  /** One line: what it means now, or, on a failure, what happened to the money and what to do. */
  readonly description?: ReactNode
  /** In place of the mark: an agent's butterfly, an illustration. */
  readonly media?: ReactNode
  /** `card` inside a chat card, sheet or dialog; `page` for a step of its own. */
  readonly size?: "card" | "page"
  /** The next steps: one primary action and a quiet one at most. */
  readonly actions?: ReactNode
  /** The facts under the title (a `SummaryList`), or what the agent can do now. */
  readonly children?: ReactNode
}

/**
 * The end of something you asked for: the mark, what happened in one sentence, the facts, then what to do next.
 * A success is announced politely; a failure is an alert and always names the next step.
 */
export function Outcome(
  { tone, title, description, media, size = "card", actions, children, className, ...props }: OutcomeProps
) {
  const page = size === "page"

  return (
    <div
      data-slot="outcome"
      data-tone={tone}
      data-size={size}
      role={tone === "failure" ? "alert" : "status"}
      className={cn(
        "grid w-full justify-items-center text-center",
        page ? "gap-3 px-2 py-4" : "gap-2.5 py-1",
        className
      )}
      {...props}
    >
      {media ?? <OutcomeMark tone={tone} size={page ? 56 : 40} className="mb-1" />}
      <div className="grid gap-1">
        <h3
          className={cn(
            "font-semibold text-ink",
            page ? "text-title-2" : "text-[17px] leading-tight tracking-[-0.015em]"
          )}
        >
          {title}
        </h3>
        {description === undefined ?
          null :
          <p className={cn("mx-auto max-w-[44ch] text-g-600", page ? "text-body" : "text-label")}>{description}</p>}
      </div>
      {children === undefined ? null : <div className="grid w-full gap-2 text-left">{children}</div>}
      {actions === undefined ?
        null :
        <div className={cn("flex w-full flex-wrap justify-center gap-2", page ? "mt-2" : "mt-1")}>{actions}</div>}
    </div>
  )
}

/** A line under an outcome or a summary that points somewhere else: "View on BaseScan". */
export function OutcomeLink({ className, children, ...props }: ComponentProps<"a">) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 justify-self-center text-label-sm font-medium text-g-500 hover:text-blue",
        className
      )}
      {...props}
    >
      {children}
      <Icon name="external" size={12} />
    </a>
  )
}
