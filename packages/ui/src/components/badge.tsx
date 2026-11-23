import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export const badgeVariants = cva(
  "inline-flex h-[22px] shrink-0 items-center gap-1 rounded-xs px-2 text-caption font-semibold whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_0_0_1px_#1d47dc]",
        secondary: "bg-g-100 text-g-700 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]",
        outline: "bg-white text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-200)]",
        success: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]",
        warning: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]",
        destructive: "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]",
        count:
          "h-5 min-w-5 animate-pop-in justify-center rounded-[10px] bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] px-1.5 text-[11.5px] text-white tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_0_0_1px_#1d47dc]"
      }
    },
    defaultVariants: { variant: "default" }
  }
)

export interface BadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

/** A small label for a count, a category or a state. */
export function Badge({ variant, className, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-variant={variant ?? "default"}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}
