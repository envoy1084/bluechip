import { Separator as BaseSeparator } from "@base-ui/react/separator"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

/** A hairline between groups. Vertical separators take the height of their row. */
export function Separator({ orientation = "horizontal", className, ...props }: ComponentProps<typeof BaseSeparator>) {
  return (
    <BaseSeparator
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-g-200",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        className
      )}
      {...props}
    />
  )
}
