import { Toggle as BaseToggle } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"
import { haptic } from "../lib/haptics.ts"

export const toggleVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-[7px] rounded-sm bg-transparent font-sans font-[550] whitespace-nowrap text-g-600 select-none",
    "transition-[background,color,box-shadow] duration-fast ease-brand",
    "hover:bg-g-100 hover:text-ink",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    "data-disabled:cursor-not-allowed data-disabled:opacity-45 data-disabled:hover:bg-transparent"
  ],
  {
    variants: {
      variant: {
        default:
          "data-pressed:bg-[linear-gradient(180deg,#fff,#f6f7f9)] data-pressed:text-ink data-pressed:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.1),0_1px_2px_rgba(10,11,13,.08)] data-pressed:[&_svg]:text-blue",
        outline:
          "shadow-[inset_0_0_0_1px_rgba(10,11,13,.12)] hover:bg-g-50 data-pressed:bg-blue-50 data-pressed:text-blue data-pressed:shadow-[inset_0_0_0_1px_var(--color-info-line)]"
      },
      size: {
        sm: "h-[30px] min-w-[30px] px-[9px] text-label",
        md: "h-9 min-w-9 px-[11px] text-[13.5px]",
        lg: "h-[42px] min-w-[42px] px-3.5 text-body-sm"
      }
    },
    defaultVariants: { variant: "default", size: "md" }
  }
)

export interface ToggleProps extends ComponentProps<typeof BaseToggle>, VariantProps<typeof toggleVariants> {}

/** A two-state button for a view preference, like hiding balances. Icon-only toggles need an `aria-label`. */
export function Toggle({ variant, size, className, onPressedChange, ...props }: ToggleProps) {
  return (
    <BaseToggle
      data-slot="toggle"
      data-variant={variant ?? "default"}
      className={cn(toggleVariants({ variant, size }), className)}
      onPressedChange={(pressed, details) => {
        haptic("select")
        onPressedChange?.(pressed, details)
      }}
      {...props}
    />
  )
}
