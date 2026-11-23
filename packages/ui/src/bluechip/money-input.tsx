import { type ChangeEvent, type ReactNode, useId, useState } from "react"
import { Button } from "../components/button.tsx"
import { InputGroup, InputGroupInput, InputGroupText, InputGroupToken } from "../components/input-group.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"

const grouping = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
const twoDecimals = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Formats what someone typed as they type it: digits only, one decimal point, at most two decimals and thousands
 * commas. A trailing point is kept so "12." can become "12.5".
 */
export const formatMoneyInput = (text: string): string => {
  const raw = text.replace(/[^\d.]/g, "")
  const dot = raw.indexOf(".")
  const whole = (dot < 0 ? raw : raw.slice(0, dot)).replace(/^0+(?=\d)/, "")
  if (dot < 0) return whole === "" ? "" : grouping.format(Number(whole))
  const fraction = raw.slice(dot + 1).replace(/\./g, "").slice(0, 2)
  return `${whole === "" ? "0" : grouping.format(Number(whole))}.${fraction}`
}

/** The amount in a money field's text, or `null` when it holds no number. */
export const parseMoneyInput = (text: string): number | null =>
  /\d/.test(text) ? Number(formatMoneyInput(text).replace(/,/g, "")) : null

/** What the amount in a money field means: nothing yet, fine, worth a warning, or an error that blocks it. */
export type MoneyInputCheck =
  | { readonly status: "empty" }
  | { readonly status: "valid" }
  | { readonly status: "warning"; readonly message: string }
  | { readonly status: "error"; readonly message: string }

export interface MoneyLimits {
  /** Cash you can spend. More than this is an error. */
  readonly available?: number
  /** The smallest amount. Defaults to $1. */
  readonly min?: number
  /** The largest amount allowed here, like an agent's max per trade. */
  readonly max?: number
  /** Above this the amount is allowed but needs your OK with Face ID. */
  readonly approvalAbove?: number
}

/** Checks an amount against the limits, in the order people need to hear about them. */
export const checkMoneyInput = (amount: number | null, limits: MoneyLimits): MoneyInputCheck => {
  const min = limits.min ?? 1
  if (amount === null) return { status: "empty" }
  if (amount < min) return { status: "error", message: `The smallest amount is ${formatMoney(min)}.` }
  if (limits.available !== undefined && amount > limits.available) {
    return {
      status: "error",
      message: `You have ${formatMoney(limits.available)} in cash. Add cash or lower the amount.`
    }
  }
  if (limits.max !== undefined && amount > limits.max) {
    return { status: "error", message: `The most you can use here is ${formatMoney(limits.max)}.` }
  }
  if (limits.approvalAbove !== undefined && amount > limits.approvalAbove) {
    return { status: "warning", message: `Over ${formatMoney(limits.approvalAbove)} needs your OK with Face ID.` }
  }
  return { status: "valid" }
}

export interface MoneyInputProps extends MoneyLimits {
  /** What the money is for: "Buy Nvidia with". */
  readonly label: ReactNode
  /** Shown under the label, like "Cash (USDC) · $1,497.64 available". */
  readonly description?: ReactNode
  /** `usd` shows a `$` before the amount; `usdc` shows the USDC token after it. */
  readonly currency?: "usd" | "usdc"
  readonly defaultValue?: number
  readonly onValueChange?: (amount: number | null, check: MoneyInputCheck) => void
  /** One-tap amounts under the field. */
  readonly quickAmounts?: ReadonlyArray<number>
  /** Shows a Max button that fills `available` (or `max` if it is lower). */
  readonly showMax?: boolean
  /** Helper text while the amount is fine, like what it buys. */
  readonly hint?: ReactNode | ((amount: number) => ReactNode)
  /** Shown while the field is empty. Defaults to the smallest amount. */
  readonly emptyHint?: ReactNode
  readonly disabled?: boolean
  /** Why the field is off, like "Buying opens Monday at 09:30 New York time." */
  readonly disabledReason?: ReactNode
  /** `lg` for the trade screen (32 px figures), `md` inside forms and lists. */
  readonly size?: "md" | "lg"
  readonly className?: string
}

const toText = (amount: number | undefined): string =>
  amount === undefined ? "" : formatMoneyInput(twoDecimals.format(amount).replace(/\.00$/, ""))

/**
 * How much cash (USDC) to use. Formats as you type, says what's wrong in plain words, and Max fills what you can
 * spend. The amount is reported as a number, or `null` while the field is empty.
 */
export function MoneyInput({
  label,
  description,
  currency = "usd",
  defaultValue,
  onValueChange,
  quickAmounts,
  showMax = true,
  hint,
  emptyHint,
  disabled = false,
  disabledReason,
  size = "lg",
  className,
  ...limits
}: MoneyInputProps) {
  const id = useId()
  const [text, setText] = useState(() => toText(defaultValue))
  const amount = parseMoneyInput(text)
  const check = checkMoneyInput(amount, limits)
  const ceiling = Math.min(limits.available ?? Infinity, limits.max ?? Infinity)

  const commit = (next: string) => {
    setText(next)
    const nextAmount = parseMoneyInput(next)
    onValueChange?.(nextAmount, checkMoneyInput(nextAmount, limits))
  }

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    // Keep the caret where it was relative to the end, so commas appearing don't push it around.
    const fromEnd = input.value.length - (input.selectionStart ?? input.value.length)
    const next = formatMoneyInput(input.value)
    commit(next)
    requestAnimationFrame(() => {
      const position = Math.max(0, next.length - fromEnd)
      input.setSelectionRange(position, position)
    })
  }

  const message = disabled ?
    disabledReason :
    check.status === "error" || check.status === "warning" ?
    check.message :
    check.status === "valid" ?
    (typeof hint === "function" && amount !== null ? hint(amount) : typeof hint === "function" ? null : hint) :
    emptyHint ?? `Enter an amount. The smallest is ${formatMoney(limits.min ?? 1)}.`

  const large = size === "lg"
  return (
    <div
      data-slot="money-input"
      data-status={disabled ? "disabled" : check.status}
      className={cn("grid w-full min-w-0 gap-3", disabled && "opacity-60", className)}
    >
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-body-sm font-semibold">{label}</label>
        {description && <span className="text-label-sm text-g-500">{description}</span>}
      </div>
      <InputGroup
        className={cn(
          "bg-g-50 shadow-[inset_0_0_0_1px_rgba(10,11,13,.08),inset_0_1px_2px_rgba(10,11,13,.03)] focus-within:bg-white",
          large ? "h-auto gap-1.5 rounded-[14px] py-2.5 pr-2.5 pl-4" : "h-auto rounded-[10px] py-1.5 pr-1.5 pl-2.5",
          check.status === "warning" && !disabled &&
            "bg-warn-wash shadow-[inset_0_0_0_1px_var(--color-warn-line)]",
          check.status === "error" && !disabled &&
            "bg-white shadow-[0_0_0_1px_var(--color-loss),0_0_0_4px_rgba(217,58,28,.12)]"
        )}
      >
        {currency === "usd" && (
          <InputGroupText
            className={cn("font-semibold text-g-400", large ? "text-[30px] tracking-[-0.03em]" : "text-[18px]")}
          >
            $
          </InputGroupText>
        )}
        <InputGroupInput
          id={id}
          value={text}
          onChange={onChange}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          disabled={disabled}
          aria-invalid={check.status === "error" && !disabled}
          aria-describedby={`${id}-message`}
          className={cn(
            "font-semibold tabular-nums placeholder:text-g-300",
            large ? "text-[32px] leading-[1.2] tracking-[-0.035em]" : "text-[18px] tracking-[-0.02em]"
          )}
        />
        {currency === "usdc" && <InputGroupToken>USDC</InputGroupToken>}
        {showMax && Number.isFinite(ceiling) && (
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => commit(toText(ceiling))}
          >
            Max
          </Button>
        )}
      </InputGroup>
      {quickAmounts && quickAmounts.length > 0 && (
        <fieldset aria-label="Quick amounts" className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0">
          {quickAmounts.map((quick) => (
            <button
              key={quick}
              type="button"
              disabled={disabled}
              onClick={() => commit(toText(quick))}
              className="cursor-pointer rounded-full bg-g-100 px-[11px] py-[5px] text-label-sm font-[550] text-g-700 tabular-nums transition-colors duration-fast ease-brand hover:bg-g-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:cursor-not-allowed"
            >
              {formatMoney(quick).replace(/\.00$/, "")}
            </button>
          ))}
        </fieldset>
      )}
      <p
        id={`${id}-message`}
        aria-live="polite"
        className={cn(
          "min-h-[1.45em] text-label-sm text-g-500",
          !disabled && check.status === "error" && "text-loss",
          !disabled && check.status === "warning" && "text-warn"
        )}
      >
        {message}
      </p>
    </div>
  )
}
