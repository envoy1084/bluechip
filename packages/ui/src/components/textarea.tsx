import { Input as BaseInput } from "@base-ui/react/input"
import { mergeProps } from "@base-ui/react/merge-props"
import { type ComponentProps, type ReactNode, useId, useState } from "react"
import { cn } from "../lib/cn.ts"
import { fieldSurface } from "./input.tsx"

export interface TextareaProps extends Omit<ComponentProps<"textarea">, "value" | "defaultValue"> {
  readonly value?: string
  readonly defaultValue?: string
  /** A soft character limit: shows a live `count / limit` counter and marks the field invalid past it. */
  readonly limit?: number
  /** Text shown left of the counter, usually a `FieldDescription`. */
  readonly hint?: ReactNode
}

/**
 * Multi-line text that grows with what you type (`field-sizing: content`). Inside a `Field` it is the field's
 * control, so the label, description and validation state apply to it.
 */
export function Textarea({
  limit,
  hint,
  className,
  value,
  defaultValue,
  disabled,
  onChange,
  ...props
}: TextareaProps) {
  const counterId = useId()
  const [typed, setTyped] = useState(() => (defaultValue ?? "").length)
  const count = value === undefined ? typed : value.length
  const over = limit !== undefined && count > limit

  // Base UI's input is the field control; it renders our textarea so Field wiring (id, aria, validity) applies.
  const textarea = (
    <BaseInput
      data-slot="textarea"
      {...(value === undefined ? {} : { value })}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(disabled === undefined ? {} : { disabled })}
      className={cn(
        "block min-h-16 w-full min-w-0 resize-none rounded-md px-3 py-2.5 font-sans text-body-sm leading-normal outline-none field-sizing-content placeholder:text-g-400",
        fieldSurface,
        "focus:shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(42,91,255,.12)] aria-[invalid=true]:focus:shadow-[0_0_0_1px_var(--color-loss),0_0_0_4px_rgba(217,58,28,.12)] data-invalid:focus:shadow-[0_0_0_1px_var(--color-loss),0_0_0_4px_rgba(217,58,28,.12)]",
        "disabled:cursor-not-allowed disabled:bg-g-50 disabled:text-g-400 disabled:shadow-[0_0_0_1px_rgba(10,11,13,.08)]",
        className
      )}
      render={(controlProps) => {
        const describedBy = [
          controlProps["aria-describedby"],
          props["aria-describedby"],
          limit === undefined ? undefined : counterId
        ].filter(Boolean).join(" ")
        return (
          <textarea
            {...mergeProps<"textarea">(
              controlProps as ComponentProps<"textarea">,
              props,
              {
                onChange: (event) => {
                  setTyped(event.currentTarget.value.length)
                  onChange?.(event)
                }
              },
              over ? { "aria-invalid": true } : undefined
            )}
            aria-describedby={describedBy || undefined}
          />
        )
      }}
    />
  )
  if (limit === undefined && hint === undefined) return textarea

  return (
    <div data-slot="textarea-group" className="grid gap-[7px]">
      {textarea}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{hint}</div>
        {limit !== undefined && (
          <span
            id={counterId}
            data-slot="textarea-counter"
            aria-live="polite"
            data-over={over || undefined}
            className="text-caption whitespace-nowrap text-g-400 tabular-nums data-over:font-semibold data-over:text-loss"
          >
            {count} / {limit}
          </span>
        )}
      </div>
    </div>
  )
}
