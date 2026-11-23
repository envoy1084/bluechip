import type { CSSProperties, ElementType, ReactNode } from "react"
import { TextMorph as TorphTextMorph } from "torph/react"
import { EASE } from "../motion/easing.ts"

export interface TextMorphProps {
  /** The text. Anything that isn't a string or a number is shown as it is, without the morph. */
  readonly children: ReactNode
  /** The element to render. Defaults to `span`. */
  readonly as?: ElementType
  /** Milliseconds for one morph. Defaults to 320. */
  readonly duration?: number
  readonly className?: string
  readonly style?: CSSProperties
}

/**
 * Text that changes in place (torph): letters it keeps slide to their new place, the rest fade, so "Approve" →
 * "Approving…" → "Approved" reads as one label changing. Use it for state labels, not for content. Screen readers
 * get the plain text, and under reduced motion it changes at once.
 */
export function TextMorph({ children, as = "span", duration = 320, className, style }: TextMorphProps) {
  if (typeof children !== "string" && typeof children !== "number") {
    const Element = as
    return <Element data-slot="text-morph" className={className} style={style}>{children}</Element>
  }
  return (
    <TorphTextMorph
      as={as}
      duration={duration}
      ease={EASE.brand}
      locale="en-US"
      {...(className === undefined ? {} : { className })}
      {...(style === undefined ? {} : { style })}
    >
      {children}
    </TorphTextMorph>
  )
}
