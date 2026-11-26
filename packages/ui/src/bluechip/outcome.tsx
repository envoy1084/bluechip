import { Children, type ComponentProps, type ReactNode, useEffect, useRef } from "react"
import { Spinner } from "../components/spinner.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { EASE } from "../motion/easing.ts"
import { prefersReducedMotion } from "../motion/reduced-motion.ts"

/**
 * Where something you asked for is: on its way (Base takes a couple of seconds), through, not through with nothing
 * moved, or left as it was by you (declined, dismissed, cancelled).
 */
export type OutcomeTone = "pending" | "success" | "failure" | "neutral"

const MARK_PATH: Readonly<Record<Exclude<OutcomeTone, "pending">, string>> = {
  success: "M5 12.5l4.5 4.5L19 7.5",
  failure: "M7 7l10 10M17 7L7 17",
  neutral: "M7 12h10"
}

export interface OutcomeMarkProps {
  readonly tone: OutcomeTone
  /** 40 inside a card or dialog, 56 on a page. */
  readonly size?: number
  readonly className?: string
}

/**
 * The round mark at the top of an end state: a spinner in a blue ring while it's on its way, then a check that draws
 * itself in a green disc, or a cross in a red one. The disc settles from 0.9 and the stroke draws once each time the
 * tone changes; under reduced motion both are already there.
 */
export function OutcomeMark({ tone, size = 40, className }: OutcomeMarkProps) {
  const disc = useRef<HTMLSpanElement>(null)
  const stroke = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (tone === "pending" || prefersReducedMotion()) return
    disc.current?.animate(
      [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }],
      { duration: 300, easing: EASE.brand, fill: "backwards" }
    )
    stroke.current?.animate(
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: 360, delay: 120, easing: "ease-out", fill: "backwards" }
    )
  }, [tone])

  return (
    <span
      ref={disc}
      aria-hidden
      data-slot="outcome-mark"
      data-tone={tone}
      style={{ width: size, height: size }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full text-white",
        tone === "pending" && "bg-blue-50 text-blue shadow-[inset_0_0_0_1.5px_var(--color-info-line)]",
        tone === "success" &&
          "bg-[linear-gradient(180deg,#23a463,var(--color-gain))] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_0_0_4px_var(--color-gain-wash)]",
        tone === "neutral" && "bg-g-100 text-g-500 shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]",
        tone === "failure" &&
          "bg-[linear-gradient(180deg,#e2492b,var(--color-loss))] shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_0_0_4px_var(--color-loss-wash)]",
        className
      )}
    >
      {tone === "pending" ?
        <Spinner size={size * 0.45} /> :
        (
          <svg viewBox="0 0 24 24" fill="none" width={size * 0.5} height={size * 0.5}>
            <path
              ref={stroke}
              d={MARK_PATH[tone]}
              pathLength={1}
              strokeDasharray="1"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
    </span>
  )
}

export interface OutcomeProps extends Omit<ComponentProps<"div">, "title"> {
  readonly tone: OutcomeTone
  /** What happened, as a sentence: "Buying $50 of Apple", "Bought $50 of Apple", "Your buy didn't go through". */
  readonly title: ReactNode
  /** One line: what it means now, or, on a failure, what happened to the money and what to do. */
  readonly description?: ReactNode
  /** In place of the mark: an agent's butterfly, an illustration. */
  readonly media?: ReactNode
  /** `card` inside a chat card, sheet or dialog; `page` for a step of its own. */
  readonly size?: "card" | "page"
  /** The next steps: one primary action and a quiet one at most. */
  readonly actions?: ReactNode
  /** The facts under the title (an `OrderPreview`), or what the agent can do now. */
  readonly children?: ReactNode
}

/**
 * The end of something you asked for: the mark, what happened in one sentence, the facts, then what to do next.
 * Keep one mounted from sending to the end so the mark turns from spinner to check in place. Pending and success are
 * announced politely; a failure is an alert and always names the next step.
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
      aria-busy={tone === "pending" || undefined}
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
      {Children.toArray(children).length === 0 ? null : <div className="grid w-full gap-2 text-left">{children}</div>}
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
