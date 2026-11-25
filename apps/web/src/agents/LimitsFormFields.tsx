import type { LimitChange } from "@bluechip/domain/agents/Rules"
import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { Slider } from "@bluechip/ui/components/slider"
import { cn } from "@bluechip/ui/lib/cn"
import { type ReactNode, useId, useState } from "react"

const CHANGE_TONE: Readonly<Record<Exclude<LimitChange, "same">, string>> = {
  tighter: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]",
  looser: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
}

/** Whether an edited limit is tighter or looser than the one locked now; nothing when it's the same. */
export function ChangeMark({ change }: Readonly<{ change: LimitChange | undefined }>) {
  if (change === undefined || change === "same") return null
  return (
    <span
      data-change={change}
      className={cn("rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap", CHANGE_TONE[change])}
    >
      {change === "tighter" ? "Tighter" : "Looser"}
    </span>
  )
}

/** One block of the limits card, with its title, change mark and the problem that blocks locking it. */
export function LimitSection(
  { title, titleId, change, problem, actions, children }: Readonly<{
    title: string
    titleId?: string
    change?: LimitChange | undefined
    problem?: string | undefined
    actions?: ReactNode
    children: ReactNode
  }>
) {
  return (
    <div className="grid gap-2.5 border-b border-g-100 px-[18px] py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span id={titleId} className="text-[13.5px] font-semibold">{title}</span>
          <ChangeMark change={change} />
        </div>
        {actions}
      </div>
      {children}
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}

export type NumberUnit = "dollars" | "percent" | "count"

const SLIDER_FORMAT: Readonly<Record<NumberUnit, Intl.NumberFormatOptions>> = {
  dollars: { style: "currency", currency: "USD", maximumFractionDigits: 0 },
  percent: { style: "unit", unit: "percent" },
  count: {}
}

/**
 * A number limit: typed or dragged. While the field is being typed in it keeps its own text, so clearing it to type
 * a new number doesn't snap the limit to zero; the limit follows each whole number typed.
 */
export function NumberLimit(
  { label, help, value, min, max, step, unit, change, problem, onChange }: Readonly<{
    label: string
    help: string
    value: number
    min: number
    max: number
    step: number
    unit: NumberUnit
    change?: LimitChange | undefined
    problem?: string | undefined
    onChange: (value: number) => void
  }>
) {
  const id = useId()
  const [text, setText] = useState<string | null>(null)

  return (
    <div className="grid gap-1.5 border-b border-g-100 px-[18px] py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-[13.5px] font-semibold">{label}</label>
          <ChangeMark change={change} />
        </div>
        <InputGroup size="sm" className="w-[92px] shrink-0 font-semibold">
          {unit === "dollars" && <InputGroupText>$</InputGroupText>}
          <InputGroupInput
            id={id}
            inputMode="numeric"
            autoComplete="off"
            className="text-right tabular-nums"
            value={text ?? String(value)}
            aria-invalid={problem === undefined ? undefined : true}
            aria-describedby={`${id}-help`}
            onChange={(event) => {
              const digits = event.currentTarget.value.replace(/\D/g, "")
              setText(digits)
              if (digits !== "") onChange(Number(digits))
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

      <p id={`${id}-help`} className={cn("text-label-sm text-g-500", problem !== undefined && "font-medium text-loss")}>
        {problem ?? help}
      </p>
    </div>
  )
}
