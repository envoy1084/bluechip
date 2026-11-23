import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export interface AspectRatioProps extends ComponentProps<"div"> {
  /** Width over height, like `16 / 9`. */
  readonly ratio: number
}

/** Keeps media at a fixed shape at any width: share cards, charts, art. The child fills it. */
export function AspectRatio({ ratio, className, style, ...props }: AspectRatioProps) {
  return (
    <div
      data-slot="aspect-ratio"
      className={cn("relative w-full overflow-hidden *:size-full *:object-cover", className)}
      style={{ aspectRatio: ratio, ...style }}
      {...props}
    />
  )
}
