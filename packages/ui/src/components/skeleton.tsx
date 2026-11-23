import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

/**
 * The shape of something loading. Size it like the content it stands in for, and set `aria-busy` on the region
 * that is loading. The shimmer stops under reduced motion.
 */
export function Skeleton({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "block h-3.5 animate-shimmer rounded-xs bg-[linear-gradient(90deg,var(--color-g-100)_0%,#f7f8fa_40%,var(--color-g-100)_80%)] bg-size-[300%_100%]",
        className
      )}
      {...props}
    />
  )
}
