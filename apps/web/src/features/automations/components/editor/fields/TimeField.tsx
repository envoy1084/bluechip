import { Input } from "@bluechip/ui/components/input"
import { useId } from "react"

/** A time of day, 24-hour. Clearing it keeps the time it had. */
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
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-medium text-g-700">{label}</label>
        <Input
          id={id}
          type="time"
          size="sm"
          value={value}
          aria-invalid={problem === undefined ? undefined : true}
          onChange={(event) => event.currentTarget.value !== "" && onChange(event.currentTarget.value)}
          className="w-[120px] tabular-nums"
        />
      </div>
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
