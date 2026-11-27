import { cn } from "@bluechip/ui/lib/cn"
import { type HTMLAttributes, useRef } from "react"
import { useInView } from "../hooks/useInView.ts"

/**
 * Content that rises into place the first time it scrolls into view, `delay` milliseconds after the moment, so a
 * row of cards can arrive one after another. A list's items pass `as="li"`. Under reduced motion it is simply there.
 */
export function Reveal(
  { as = "div", delay = 0, className, style, ...props }: HTMLAttributes<HTMLElement> & {
    readonly as?: "div" | "li"
    readonly delay?: number
  }
) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null)
  const shown = useInView(ref)
  const revealed = {
    ...props,
    "data-shown": shown || undefined,
    className: cn(
      "translate-y-5 opacity-0 transition-[opacity,translate] duration-[900ms] ease-brand data-shown:translate-y-0 data-shown:opacity-100",
      "motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
      className
    ),
    style: { transitionDelay: `${delay}ms`, ...style }
  }

  return as === "li" ? <li ref={ref} {...revealed} /> : <div ref={ref} {...revealed} />
}
