import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { Slider } from "@bluechip/ui/components/slider"
import { cn } from "@bluechip/ui/lib/cn"
import { useId, useState } from "react"

export type NumberUnit = "dollars" | "percent" | "count"

const SLIDER_FORMAT: Readonly<Record<NumberUnit, Intl.NumberFormatOptions>> = {
  dollars: { style: "currency", currency: "USD", maximumFractionDigits: 0 },
  percent: { style: "unit", unit: "percent" },
  count: {}
}

/**
 * A number, typed or dragged, in the units people think in (dollars, percent). While the field is being typed in it
 * keeps its own text, so clearing it to type a new number doesn't snap the value to zero; the value follows each
 * number typed.
 */
export function NumberField(
  { label, help, value, min, max, step, unit, problem, onChange }: Readonly<{
    label: string
    help?: string | undefined
    value: number
    min: number
    max: number
    step: number
    unit: NumberUnit
    problem?: string | undefined
    onChange: (value: number) => void
  }>
) {
  const id = useId()
  const [text, setText] = useState<string | null>(null)
  const note = problem ?? help

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-medium text-g-700">{label}</label>
        <InputGroup size="sm" className="w-[92px] shrink-0 font-semibold">
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
              if (typed !== "" && Number.isFinite(Number(typed))) onChange(Number(typed))
            }}
            onBlur={() => setText(null)}
          />
          {unit === "percent" && <InputGroupText>%</InputGroupText>}
        </InputGroup>
      </div>

      <Slider
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onValueChange={(next) => onChange(typeof next === "number" ? next : next[0] ?? min)}
        thumbLabels={[label]}
        format={SLIDER_FORMAT[unit]}
        showValues={false}
        showScale={false}
      />

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
