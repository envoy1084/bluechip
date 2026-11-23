import { Input as BaseInput } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"
import { fieldSurface } from "./input.tsx"

export const inputGroupVariants = cva(
  [
    "flex w-full min-w-0 items-center gap-2 font-sans",
    fieldSurface,
    "has-[input[aria-invalid=true]]:[--field-ring:rgba(217,58,28,.6)] has-[input[data-invalid]]:[--field-ring:rgba(217,58,28,.6)]",
    "focus-within:shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(42,91,255,.12)]",
    "has-[input[aria-invalid=true]]:focus-within:shadow-[0_0_0_1px_var(--color-loss),0_0_0_4px_rgba(217,58,28,.12)] has-[input[data-invalid]]:focus-within:shadow-[0_0_0_1px_var(--color-loss),0_0_0_4px_rgba(217,58,28,.12)]",
    "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-g-50 has-[input:disabled]:text-g-400",
    "[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-g-400"
  ],
  {
    variants: {
      size: {
        sm: "h-8 rounded-sm pr-1 pl-2.5 text-label",
        md: "h-[38px] rounded-md pr-1.5 pl-3 text-body-sm",
        lg:
          "h-[52px] rounded-[12px] pr-2 pl-3.5 text-body-sm [&_[data-slot=input-group-input]]:text-[20px] [&_[data-slot=input-group-input]]:font-semibold [&_[data-slot=input-group-input]]:tracking-[-0.02em]"
      }
    },
    defaultVariants: { size: "md" }
  }
)

export interface InputGroupProps extends ComponentProps<"div">, VariantProps<typeof inputGroupVariants> {}

/** An input with addons (icons, units, a token, a button). The whole group takes the focus ring. */
export function InputGroup({ size, className, ...props }: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      data-size={size ?? "md"}
      className={cn(inputGroupVariants({ size }), className)}
      {...props}
    />
  )
}

/** The text field inside an `InputGroup`. */
export function InputGroupInput({ className, ...props }: ComponentProps<typeof BaseInput>) {
  return (
    <BaseInput
      data-slot="input-group-input"
      className={cn(
        "h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-inherit outline-none placeholder:text-g-400 disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none",
        className
      )}
      {...props}
    />
  )
}

/** A unit or affix in an `InputGroup`: `$`, `per day`, `bluechip.app/i/`. */
export function InputGroupText({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-text"
      className={cn("text-body-sm whitespace-nowrap text-g-500 last:mr-1.5", className)}
      {...props}
    />
  )
}

/** A small icon button inside an `InputGroup`, like a clear or show-all control. Label it with `aria-label`. */
export function InputGroupButton({ className, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      data-slot="input-group-button"
      type={type}
      className={cn(
        "grid size-7 shrink-0 cursor-pointer place-items-center rounded-[7px] text-g-500 transition-colors duration-fast ease-brand hover:bg-g-100 hover:text-ink focus-visible:outline-offset-0 [&_svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

export interface InputGroupTokenProps extends ComponentProps<"span"> {
  /** The glyph in the coin. */
  readonly symbol?: string
}

/** The currency an amount is in, as a chip with its coin: `USDC`. */
export function InputGroupToken({ symbol = "$", className, children, ...props }: InputGroupTokenProps) {
  return (
    <span
      data-slot="input-group-token"
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] bg-g-50 pr-2.5 pl-1.5 text-[13.5px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-g-200)]",
        className
      )}
      {...props}
    >
      <i
        aria-hidden
        className="grid size-5 place-items-center rounded-full bg-[linear-gradient(180deg,#4c8dff,#2775ca)] text-[11px] font-bold text-white not-italic shadow-[inset_0_1px_0_rgba(255,255,255,.35)]"
      >
        {symbol}
      </i>
      {children}
    </span>
  )
}
