import { Input as BaseInput } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

/** The text-field surface shared by inputs, textareas, input groups and select triggers. */
export const fieldSurface = [
  "bg-white text-ink [--field-ring:rgba(10,11,13,.12)]",
  "shadow-[inset_0_1px_2px_rgba(10,11,13,.04),0_0_0_1px_var(--field-ring),0_1px_2px_rgba(10,11,13,.03)]",
  "transition-[box-shadow,background-color] duration-fast ease-brand",
  "hover:[--field-ring:rgba(10,11,13,.2)]",
  "aria-[invalid=true]:[--field-ring:rgba(217,58,28,.6)] data-invalid:[--field-ring:rgba(217,58,28,.6)]"
].join(" ")

export const inputVariants = cva(
  [
    "w-full min-w-0 font-sans outline-none placeholder:text-g-400",
    fieldSurface,
    "focus:shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(42, 91, 255,.12)] aria-[invalid=true]:focus:shadow-[0_0_0_1px_var(--color-loss),0_0_0_4px_rgba(217,58,28,.12)] data-invalid:focus:shadow-[0_0_0_1px_var(--color-loss),0_0_0_4px_rgba(217,58,28,.12)]",
    "disabled:cursor-not-allowed disabled:bg-g-50 disabled:text-g-400 disabled:shadow-[0_0_0_1px_rgba(10,11,13,.08)]",
    "read-only:not-disabled:bg-g-50 read-only:not-disabled:text-g-600",
    "file:mr-2.5 file:h-full file:cursor-pointer file:border-0 file:border-r file:border-solid file:border-g-200 file:bg-g-50 file:px-3 file:font-sans file:text-label file:font-[550] file:text-ink",
    "[&[type=file]]:pl-0 [&[type=file]]:text-label [&[type=file]]:text-g-500"
  ],
  {
    variants: {
      size: {
        sm: "h-8 rounded-sm px-2.5 text-label",
        md: "h-[38px] rounded-md px-3 text-body-sm",
        lg: "h-[46px] rounded-[12px] px-3.5 text-body"
      }
    },
    defaultVariants: { size: "md" }
  }
)

export interface InputProps
  extends Omit<ComponentProps<typeof BaseInput>, "size">, VariantProps<typeof inputVariants>
{}

/** Single-line text entry. Inside a `Field` it picks up the label, description and validation state. */
export function Input({ size, className, ...props }: InputProps) {
  return <BaseInput data-slot="input" className={cn(inputVariants({ size }), className)} {...props} />
}
