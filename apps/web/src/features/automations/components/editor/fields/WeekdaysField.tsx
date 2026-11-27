import type { Weekday } from "@bluechip/domain/automations/Time"
import { Button } from "@bluechip/ui/components/button"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { useId } from "react"
import { WEEKDAYS } from "../../../model/automationText.ts"

const EVERY_DAY = WEEKDAYS.map((weekday) => weekday.day)
const WORK_DAYS = EVERY_DAY.slice(0, 5)

/**
 * The days it runs on, Monday first, as chips in one row; Weekdays and Every day
 * pick the usual sets in one click.
 */
export function WeekdaysField(
  { label, value, problem, onChange }: Readonly<{
    label: string
    value: ReadonlyArray<Weekday>
    problem?: string | undefined
    onChange: (days: ReadonlyArray<Weekday>) => void
  }>
) {
  const id = useId()
  const shortcut = (name: string, days: ReadonlyArray<Weekday>) => (
    <Button
      variant="ghost"
      size="xs"
      aria-pressed={days.join() === value.join()}
      className="text-g-600 aria-pressed:text-blue"
      onClick={() => onChange(days)}
    >
      {name}
    </Button>
  )

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={id} className="text-[13.5px] font-medium text-g-700">{label}</span>
        <span className="-my-1 flex gap-0.5">
          {shortcut("Weekdays", WORK_DAYS)}
          {shortcut("Every day", EVERY_DAY)}
        </span>
      </div>
      <ToggleGroup
        multiple
        variant="outline"
        size="sm"
        aria-labelledby={id}
        value={[...value]}
        onValueChange={(days) => onChange(EVERY_DAY.filter((day) => days.includes(day)))}
        className="grid grid-cols-7 gap-1 overflow-visible sm:flex sm:flex-wrap sm:gap-1.5"
      >
        {WEEKDAYS.map((weekday) => (
          <ToggleGroupItem
            key={weekday.day}
            value={weekday.day}
            aria-label={weekday.name}
            className="min-w-0 bg-white px-0 sm:w-[46px]"
          >
            {weekday.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
