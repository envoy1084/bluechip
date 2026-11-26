import { TimePicker } from "@bluechip/ui/components/time-picker"
import { cn } from "@bluechip/ui/lib/cn"
import { useId } from "react"

/** A time of day, 24-hour, its label above it (or only for screen readers, where the row already says it). */
export function TimeField(
  { label, value, problem, disabled, labelHidden = false, onChange }: Readonly<{
    label: string
    value: string
    problem?: string | undefined
    disabled?: boolean
    labelHidden?: boolean
    onChange: (time: string) => void
  }>
) {
  const id = useId()

  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className={cn("text-[13.5px] font-medium text-g-700", labelHidden && "sr-only")}>
        {label}
      </label>
      <TimePicker
        id={id}
        size="sm"
        value={value}
        invalid={problem !== undefined}
        disabled={disabled}
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
