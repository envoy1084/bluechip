import { Radio } from "@base-ui/react/radio"
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export interface RadioGroupProps extends ComponentProps<typeof BaseRadioGroup> {
  /** Stack options (`vertical`) or line them up in a wrapping row (`horizontal`). */
  readonly orientation?: "vertical" | "horizontal"
}

/** Choose exactly one. Arrow keys move and select. */
export function RadioGroup({ orientation = "vertical", className, ...props }: RadioGroupProps) {
  return (
    <BaseRadioGroup
      data-slot="radio-group"
      data-orientation={orientation}
      className={cn(
        orientation === "vertical" ? "grid gap-3" : "flex min-h-[38px] flex-wrap items-center gap-x-5 gap-y-2",
        className
      )}
      {...props}
    />
  )
}

// The radio dot: a white dot springs in on the Base Blue fill.
const radioDot = [
  "relative inline-block size-[18px] shrink-0 rounded-full",
  "bg-[linear-gradient(180deg,#fff,#f6f7f9)] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.2),0_1px_2px_rgba(10,11,13,.05)]",
  "transition-[background,box-shadow] duration-fast ease-brand",
  "after:absolute after:inset-[5px] after:scale-0 after:rounded-full after:bg-white after:shadow-[0_1px_1px_rgba(16,40,130,.18)] after:transition-transform after:duration-base after:ease-spring after:content-['']"
].join(" ")
/** One option of a `RadioGroup`. Wrap it in a `Label` (or `FieldLabel`) with its text. */
export function RadioGroupItem({ className, ...props }: ComponentProps<typeof Radio.Root>) {
  return (
    <Radio.Root
      data-slot="radio-group-item"
      className={cn(
        radioDot,
        "cursor-pointer",
        "hover:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.32)]",
        "data-checked:bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] data-checked:shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_0_0_1px_#1d47dc,0_1px_2px_rgba(20,50,160,.18)] data-checked:after:scale-100",
        "aria-[invalid=true]:shadow-[0_0_0_1px_var(--color-loss),0_0_0_3px_rgba(217,58,28,.12)] data-invalid:shadow-[0_0_0_1px_var(--color-loss),0_0_0_3px_rgba(217,58,28,.12)]",
        "data-disabled:cursor-not-allowed data-disabled:opacity-45",
        className
      )}
      {...props}
    />
  )
}

/** A radio option with room to explain itself: an icon, a title and a line of description. */
export function RadioCard({ className, children, ...props }: ComponentProps<typeof Radio.Root>) {
  return (
    <Radio.Root
      data-slot="radio-card"
      className={cn(
        "group/radio-card flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3.5 text-left outline-none",
        "surface-field transition-[box-shadow,background] duration-fast ease-brand",
        "hover:shadow-[0_0_0_1px_rgba(10,11,13,.16),0_2px_4px_-2px_rgba(10,11,13,.06)]",
        "focus-visible:shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(42,91,255,.14)]",
        "data-checked:bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] data-checked:shadow-[0_0_0_1.5px_var(--color-blue),0_3px_8px_-4px_rgba(42,91,255,.14)]",
        "data-disabled:cursor-not-allowed data-disabled:opacity-45",
        className
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          radioDot,
          "ml-auto group-data-checked/radio-card:bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] group-data-checked/radio-card:shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_0_0_1px_#1d47dc,0_1px_2px_rgba(20,50,160,.18)] group-data-checked/radio-card:after:scale-100"
        )}
      />
    </Radio.Root>
  )
}

/** The icon tile of a `RadioCard`. */
export function RadioCardIcon({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="radio-card-icon"
      className={cn(
        "grid size-[34px] shrink-0 place-items-center rounded-md bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]",
        className
      )}
      {...props}
    />
  )
}

/** The title and description of a `RadioCard`. */
export function RadioCardContent({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="radio-card-content"
      className={cn(
        "grid min-w-0 gap-0.5 text-label-sm leading-[1.45] text-g-500 [&>strong]:text-body-sm [&>strong]:font-semibold [&>strong]:text-ink",
        className
      )}
      {...props}
    />
  )
}
