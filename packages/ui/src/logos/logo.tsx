import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export interface LogoProps extends Omit<ComponentProps<"svg">, "children" | "width" | "height" | "viewBox"> {
  /** Height in pixels; the width follows the mark's own proportions. Defaults to 20. */
  readonly size?: number
  /** Accessible label. Without one the mark is decorative and hidden from screen readers. */
  readonly label?: string
}

/** The `<svg>` every vendored mark draws into: sized by height, decorative unless labelled. */
export function Logo(
  { viewBox, size = 20, label, className, children, ...props }:
    & LogoProps
    & Pick<ComponentProps<"svg">, "viewBox" | "children">
) {
  const [, , width = 1, height = 1] = (viewBox ?? "").split(/\s+/).map(Number)
  return (
    <svg
      data-slot="logo"
      viewBox={viewBox}
      width={(size * width) / height}
      height={size}
      className={cn("shrink-0", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      {...props}
    >
      {children}
    </svg>
  )
}
