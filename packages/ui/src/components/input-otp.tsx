import { OTPField } from "@base-ui/react/otp-field"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

/** A one-time code, one character per slot. Typing moves on, Backspace moves back, paste fills every slot. */
export function InputOTP({ className, ...props }: ComponentProps<typeof OTPField.Root>) {
  return (
    <OTPField.Root
      data-slot="input-otp"
      className={cn("inline-flex items-center gap-1.5 sm:gap-2", className)}
      {...props}
    />
  )
}

/** One character of an `InputOTP`. */
export function InputOTPSlot({ className, ...props }: ComponentProps<typeof OTPField.Input>) {
  return (
    <OTPField.Input
      data-slot="input-otp-slot"
      className={cn(
        "grid h-12 w-[38px] place-items-center rounded-[11px] border-0 bg-white p-0 text-center font-sans text-[20px] font-semibold text-ink caret-blue outline-none sm:h-[52px] sm:w-11 sm:text-[22px]",
        "surface-field transition-shadow duration-fast ease-brand",
        "focus:shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(42,91,255,.12)]",
        "data-invalid:text-loss data-invalid:shadow-[0_0_0_1px_rgba(217,58,28,.6)] data-invalid:focus:shadow-[0_0_0_1px_var(--color-loss),0_0_0_4px_rgba(217,58,28,.12)]",
        "disabled:bg-g-50 disabled:text-g-400 disabled:shadow-[0_0_0_1px_rgba(10,11,13,.08)]",
        className
      )}
      {...props}
    />
  )
}

/** A short dash between groups of slots. */
export function InputOTPSeparator({ className, ...props }: ComponentProps<typeof OTPField.Separator>) {
  return (
    <OTPField.Separator
      data-slot="input-otp-separator"
      className={cn("h-0.5 w-2.5 rounded-xs bg-g-300", className)}
      {...props}
    />
  )
}
