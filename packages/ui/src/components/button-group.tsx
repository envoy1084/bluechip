import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export const buttonGroupVariants = cva(
  [
    "isolate inline-flex w-fit items-stretch rounded-md",
    "*:rounded-none *:focus-visible:z-10",
    // Two primaries side by side get a light divider instead of a doubled edge.
    "[&>[data-variant=primary]+[data-variant=primary]]:before:absolute [&>[data-variant=primary]+[data-variant=primary]]:before:inset-y-[7px] [&>[data-variant=primary]+[data-variant=primary]]:before:-left-px [&>[data-variant=primary]+[data-variant=primary]]:before:w-px [&>[data-variant=primary]+[data-variant=primary]]:before:bg-white/30"
  ],
  {
    variants: {
      orientation: {
        horizontal: "*:first:rounded-l-[inherit] *:last:rounded-r-[inherit] [&>*+*]:ml-px",
        vertical: "flex-col *:justify-start *:first:rounded-t-[inherit] *:last:rounded-b-[inherit] [&>*+*]:mt-px"
      }
    },
    defaultVariants: { orientation: "horizontal" }
  }
)

export interface ButtonGroupProps extends ComponentProps<"fieldset">, VariantProps<typeof buttonGroupVariants> {}

/** Joins related buttons into one control (a `fieldset`). Give it an `aria-label` that names the set. */
export function ButtonGroup({ orientation, className, ...props }: ButtonGroupProps) {
  return (
    <fieldset
      data-slot="button-group"
      data-orientation={orientation ?? "horizontal"}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

/** A value shown between the buttons of a group, like the amount in a stepper. */
export function ButtonGroupText({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="button-group-text"
      className={cn(
        "inline-flex min-w-[72px] items-center justify-center bg-white px-3 text-body-sm font-semibold tabular-nums shadow-[inset_0_0_0_1px_rgba(10,11,13,.1)]",
        className
      )}
      {...props}
    />
  )
}
