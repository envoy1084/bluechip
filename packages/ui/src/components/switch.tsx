import { Switch as BaseSwitch } from "@base-ui/react/switch"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"
import { haptic } from "../lib/haptics.ts"

export const switchVariants = cva(
  [
    "group/switch relative inline-flex h-(--h) w-(--w) shrink-0 cursor-pointer rounded-full p-0",
    "bg-g-200 shadow-[inset_0_1px_2px_rgba(10,11,13,.07),inset_0_0_0_1px_rgba(10,11,13,.04)] transition-[background,box-shadow] duration-base ease-brand",
    "hover:not-data-checked:not-data-disabled:bg-g-300",
    "data-checked:bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] data-checked:shadow-[inset_0_1px_2px_rgba(16,40,130,.18),0_0_0_1px_#1d47dc]",
    "data-disabled:cursor-not-allowed data-disabled:opacity-45"
  ],
  {
    variants: {
      size: { sm: "[--h:18px] [--w:30px]", md: "[--h:22px] [--w:38px]" }
    },
    defaultVariants: { size: "md" }
  }
)

export interface SwitchProps extends ComponentProps<typeof BaseSwitch.Root>, VariantProps<typeof switchVariants> {}

/** Turns a setting on or off right away, with no save button. A light haptic on phones marks the change. */
export function Switch({ size, className, onCheckedChange, ...props }: SwitchProps) {
  return (
    <BaseSwitch.Root
      data-slot="switch"
      className={cn(switchVariants({ size }), className)}
      onCheckedChange={(checked, details) => {
        haptic("select")
        onCheckedChange?.(checked, details)
      }}
      {...props}
    >
      <BaseSwitch.Thumb
        data-slot="switch-thumb"
        className={cn(
          "absolute top-0.5 left-0.5 size-[calc(var(--h)-4px)] rounded-full bg-[linear-gradient(180deg,#fff,var(--color-g-50))]",
          "shadow-[0_0_0_.5px_rgba(10,11,13,.1),0_1px_2px_rgba(10,11,13,.12),0_2px_4px_-2px_rgba(10,11,13,.1)]",
          "transition-[translate,width] duration-base ease-brand",
          "data-checked:translate-x-[calc(var(--w)-var(--h))]",
          // A pressed thumb stretches toward where it is going.
          "group-active/switch:not-data-disabled:w-[calc(var(--h)+1px)] group-active/switch:data-checked:not-data-disabled:translate-x-[calc(var(--w)-var(--h)-5px)]"
        )}
      />
    </BaseSwitch.Root>
  )
}
