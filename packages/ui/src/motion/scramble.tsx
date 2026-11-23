import { type ComponentProps, useEffect, useRef } from "react"
import { cn } from "../lib/cn.ts"
import { scramble } from "./effects/scramble.ts"

export interface ScrambleProps extends Omit<ComponentProps<"span">, "children"> {
  readonly text: string
  /** Milliseconds until the text has resolved. Defaults to 800. */
  readonly duration?: number
}

/**
 * Text that resolves left to right out of random glyphs. One heading per screen: landing headings, empty states.
 * Wrap it in the heading element. A new `text` plays again; to replay the same text, change the React `key`. Under
 * reduced motion the text is there from the start.
 */
export function Scramble({ text, duration, className, ...props }: ScrambleProps) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handle = scramble(el, text, { glyphClassName: "text-g-300", ...(duration === undefined ? {} : { duration }) })
    return handle.stop
  }, [text, duration])
  return (
    <span data-slot="scramble" className={cn(className)} {...props}>
      <span className="sr-only">{text}</span>
      {/* The engine writes this span's children, so it is keyed to be replaced rather than reconciled. */}
      <span key={text} ref={ref} aria-hidden>
        {text}
      </span>
    </span>
  )
}
