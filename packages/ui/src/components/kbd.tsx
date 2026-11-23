import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export const kbdVariants = cva(
  "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] px-[5px] font-sans text-[11.5px] leading-none font-[550]",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(180deg,#fff,var(--color-sunken))] text-g-600 shadow-[inset_0_-1px_0_rgba(10,11,13,.1),0_0_0_1px_rgba(10,11,13,.1)]",
        inset: "bg-g-100 text-g-500 shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]",
        inverse: "bg-white/16 text-white/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,.22)]"
      }
    },
    defaultVariants: { variant: "default" }
  }
)

export interface KbdProps extends ComponentProps<"kbd">, VariantProps<typeof kbdVariants> {}

/** A key or shortcut, the way it appears on the keyboard. Use `inverse` on primary buttons and dark tooltips. */
export function Kbd({ variant, className, ...props }: KbdProps) {
  return <kbd data-slot="kbd" className={cn(kbdVariants({ variant }), className)} {...props} />
}

/** Keys pressed together, like ⌘ K. */
export function KbdGroup({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-[3px] text-caption text-g-400", className)}
      {...props}
    />
  )
}
