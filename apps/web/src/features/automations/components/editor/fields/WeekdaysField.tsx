import type { Weekday } from "@bluechip/domain/automations/Time"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { useId } from "react"
import { WEEKDAYS } from "../../../model/automationText.ts"

/** The days it runs on, Monday first, as chips that wrap onto a second line when they must. */
export function WeekdaysField(
  { label, value, problem, onChange }: Readonly<{
    label: string
    value: ReadonlyArray<Weekday>
    problem?: string | undefined
    onChange: (days: ReadonlyArray<Weekday>) => void
  }>
) {
  const id = useId()

  return (
    <div className="grid gap-1.5">
      <span id={id} className="text-[13.5px] font-medium text-g-700">{label}</span>
      <ToggleGroup
        multiple
        variant="outline"
        size="sm"
        aria-labelledby={id}
        value={[...value]}
        onValueChange={(days) => onChange(WEEKDAYS.map((weekday) => weekday.day).filter((day) => days.includes(day)))}
        className="flex-wrap gap-1.5 overflow-visible"
      >
        {WEEKDAYS.map((weekday) => (
          <ToggleGroupItem
            key={weekday.day}
            value={weekday.day}
            aria-label={weekday.name}
            className="w-[46px] bg-white data-pressed:bg-ink data-pressed:text-white data-pressed:shadow-[inset_0_0_0_1px_var(--color-ink)] data-pressed:hover:bg-ink"
          >
            {weekday.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
