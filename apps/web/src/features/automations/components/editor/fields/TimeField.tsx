import { TimePicker } from "@bluechip/ui/components/time-picker"
import { useId } from "react"

/** A time of day, 24-hour, its label above it. */
export function TimeField(
  { label, value, problem, onChange }: Readonly<{
    label: string
    value: string
    problem?: string | undefined
    onChange: (time: string) => void
  }>
) {
  const id = useId()

  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-[13.5px] font-medium text-g-700">{label}</label>
      <TimePicker
        id={id}
        size="sm"
        value={value}
        invalid={problem !== undefined}
        aria-describedby={problem === undefined ? undefined : `${id}-problem`}
        onValueChange={onChange}
        className="w-full max-w-[160px]"
      />
      {problem === undefined ?
        null :
        <p id={`${id}-problem`} className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
