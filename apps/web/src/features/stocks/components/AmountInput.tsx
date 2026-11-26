import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Button } from "@bluechip/ui/components/button"
import { InputGroup, InputGroupInput } from "@bluechip/ui/components/input-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { UsdcLogo } from "@bluechip/ui/logos/usdc"
import { useId } from "react"
import { cleanAmount } from "../../../lib/amounts.ts"

/** What a trade's amount is typed in: dollars (USDC) or shares of the stock. */
export type AmountUnit = "usd" | "shares"

/**
 * The trade's amount, with its unit as a pill: press it to switch between dollars (USDC) and the stock's shares.
 * Quick amounts and Max fill the field in the current unit.
 */
export function AmountInput(
  { label, available, unit, symbol, text, hint, invalid, quickAmounts, onMax, onTextChange, onUnitChange }: Readonly<{
    label: string
    available: string
    unit: AmountUnit
    symbol: string
    text: string
    hint: string | null
    invalid: boolean
    quickAmounts: ReadonlyArray<number>
    onMax?: (() => void) | undefined
    onTextChange: (text: string) => void
    onUnitChange: (unit: AmountUnit) => void
  }>
) {
  const id = useId()
  const nextUnit = unit === "usd" ? "shares" : "usd"

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13.5px] font-semibold">{label}</label>
        <span className="text-caption text-g-500">{available}</span>
      </div>

      <InputGroup
        className={cn(
          "h-auto rounded-[10px] bg-g-50 py-1.5 pr-1.5 pl-2.5 shadow-[inset_0_0_0_1px_rgba(10,11,13,.08)] focus-within:bg-white",
          invalid && "bg-white shadow-[0_0_0_1px_var(--color-loss),0_0_0_4px_rgba(217,58,28,.12)]"
        )}
      >
        <InputGroupInput
          id={id}
          value={text}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onTextChange(cleanAmount(event.currentTarget.value, unit === "usd" ? 2 : 8))}
          className="text-[18px] font-semibold tracking-[-0.02em] tabular-nums placeholder:text-g-300"
        />
        {onMax !== undefined && <Button variant="secondary" size="sm" onClick={onMax}>Max</Button>}
        <button
          type="button"
          onClick={() => onUnitChange(nextUnit)}
          aria-label={`Amount in ${unit === "usd" ? "USDC" : `${symbol} shares`}. Switch to ${
            nextUnit === "usd" ? "USDC" : "shares"
          }`}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] bg-white pr-2 pl-1.5 text-[13.5px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-g-200)] transition-colors duration-fast ease-brand hover:bg-g-50 focus-visible:shadow-[0_0_0_2px_var(--color-blue)] focus-visible:outline-none"
        >
          {unit === "usd" ?
            (
              <>
                <UsdcLogo size={20} />USDC
              </>
            ) :
            <TickerChip symbol={symbol} size="sm" />}
          <Icon name="sort" size={14} className="text-g-400" />
        </button>
      </InputGroup>

      {unit === "usd" && quickAmounts.length > 0 && (
        <fieldset aria-label="Quick amounts" className="flex flex-wrap gap-1.5">
          {quickAmounts.map((amount) => (
            <Button
              key={amount}
              variant="secondary"
              size="xs"
              onClick={() => onTextChange(String(amount))}
            >
              ${amount}
            </Button>
          ))}
        </fieldset>
      )}

      <p
        id={`${id}-hint`}
        aria-live="polite"
        className={cn("min-h-[1.4em] text-caption", invalid ? "text-loss" : "text-g-500")}
      >
        {hint}
      </p>
    </div>
  )
}
