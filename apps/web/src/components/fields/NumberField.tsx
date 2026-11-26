import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { Slider } from "@bluechip/ui/components/slider"
import { Toggle } from "@bluechip/ui/components/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@bluechip/ui/components/tooltip"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useId, useState } from "react"
import { FieldHelp } from "./FieldHelp.tsx"

export type NumberUnit = "dollars" | "percent" | "count"

const SLIDER_FORMAT: Readonly<Record<NumberUnit, Intl.NumberFormatOptions>> = {
  dollars: { style: "currency", currency: "USD", maximumFractionDigits: 0 },
  percent: { style: "unit", unit: "percent" },
  count: {}
}

/**
 * A number, typed or dragged, in the units people think in (dollars, percent). The slider covers the usual range
 * (`min` to `max`); with a `ceiling` above it, "Custom amount" swaps the slider for a wider box that takes anything up to
 * the ceiling, and a value past the slider opens that way. The slider snaps to round values (multiples of `step` from
 * zero, $5, $10… rather than $1, $6…), and its left end is `min` itself. While the field is being typed in it keeps its own text, so
 * clearing it to type a new number doesn't snap the value to zero; the value follows each number typed.
 */
export function NumberField(
  { label, labelHidden = false, help, value, min, max, ceiling, step, unit, problem, onChange }: Readonly<{
    label: string
    /** Named for screen readers only, where the heading above already says it (a rule's own title). */
    labelHidden?: boolean
    help?: string | undefined
    value: number
    min: number
    /** Where the slider ends. */
    max: number
    /** The most a custom amount may be, when it's more than the slider's end. */
    ceiling?: number | undefined
    step: number
    unit: NumberUnit
    problem?: string | undefined
    onChange: (value: number) => void
  }>
) {
  const id = useId()
  const [text, setText] = useState<string | null>(null)
  const canCustom = ceiling !== undefined && ceiling > max
  const [custom, setCustom] = useState(() => canCustom && value > max)
  const note = problem
  const sliderMin = Math.floor(min / step) * step

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5">
          <label htmlFor={id} className={cn("text-[13.5px] font-medium text-g-700", labelHidden && "sr-only")}>
            {label}
          </label>
          <FieldHelp label={label} help={help} />
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {canCustom && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Toggle
                    variant="outline"
                    size="sm"
                    aria-label="Custom amount"
                    pressed={custom}
                    onPressedChange={(next) => {
                      // Back on the slider, a custom amount past its end comes down to it.
                      if (!next && value > max) onChange(max)
                      setCustom(next)
                    }}
                    className="h-8 min-w-8 px-0"
                  />
                }
              >
                <Icon name="keyboard" size={15} />
              </TooltipTrigger>
              <TooltipContent>{custom ? "Back to the slider" : "Type a custom amount"}</TooltipContent>
            </Tooltip>
          )}
          <InputGroup size="sm" className={cn("shrink-0 font-semibold", custom ? "w-[140px]" : "w-[92px]")}>
            {unit === "dollars" && <InputGroupText>$</InputGroupText>}
            <InputGroupInput
              id={id}
              inputMode={unit === "percent" ? "decimal" : "numeric"}
              autoComplete="off"
              className="text-right tabular-nums"
              value={text ?? String(value)}
              aria-invalid={problem === undefined ? undefined : true}
              aria-describedby={note === undefined ? undefined : `${id}-note`}
              onChange={(event) => {
                const typed = event.currentTarget.value.replace(unit === "percent" ? /[^\d.]/g : /\D/g, "")
                setText(typed)
                if (typed === "" || !Number.isFinite(Number(typed))) return
                // Typing past the slider's end moves to a custom amount, when there's room above it.
                if (canCustom && Number(typed) > max) setCustom(true)
                onChange(Number(typed))
              }}
              onBlur={() => setText(null)}
            />
            {unit === "percent" && <InputGroupText>%</InputGroupText>}
          </InputGroup>
        </span>
      </div>

      {custom ? null : (
        <Slider
          min={sliderMin}
          max={max}
          step={step}
          value={Math.min(max, Math.max(sliderMin, value))}
          onValueChange={(next) => onChange(Math.max(min, typeof next === "number" ? next : next[0] ?? min))}
          thumbLabels={[label]}
          format={SLIDER_FORMAT[unit]}
          showValues={false}
          showScale={false}
        />
      )}

      {note === undefined ? null : (
        <p
          id={`${id}-note`}
          className={cn("text-label-sm text-g-500", problem !== undefined && "font-medium text-loss")}
        >
          {note}
        </p>
      )}
    </div>
  )
}
