import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

/** Label typography, shared with `FieldLabel` and `SelectLabel`. */
export const labelClassName =
  "inline-flex items-center gap-2 text-[13.5px] leading-[1.35] font-[550] text-ink select-none has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:text-g-400"

export interface LabelProps extends ComponentProps<"label"> {
  /** Shows a red asterisk. It is hidden from screen readers: the control itself carries `required`. */
  readonly required?: boolean
}

/** Names a control. Clicking it focuses or toggles the control it belongs to. */
export function Label({ required = false, className, children, ...props }: LabelProps) {
  return (
    <label data-slot="label" className={cn(labelClassName, "cursor-pointer", className)} {...props}>
      {children}
      {required && <RequiredMark />}
    </label>
  )
}

/** The asterisk after a required field's label. */
export function RequiredMark() {
  return (
    <span aria-hidden className="-ml-1.5 text-loss">
      *
    </span>
  )
}
