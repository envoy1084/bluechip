import { Switch } from "@bluechip/ui/components/switch"
import { cn } from "@bluechip/ui/lib/cn"
import { useId } from "react"

/** A setting that is on or off, with what it means beside it. */
export function ToggleField(
  { label, help, checked, disabled, problem, onChange }: Readonly<{
    label: string
    help?: string | undefined
    checked: boolean
    disabled?: boolean
    problem?: string | undefined
    onChange: (checked: boolean) => void
  }>
) {
  const id = useId()
  const note = problem ?? help

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-[13.5px] font-medium text-g-700">{label}</label>
        {note === undefined ?
          null :
          <p className={cn("text-label-sm text-g-500", problem !== undefined && "font-medium text-loss")}>{note}</p>}
      </div>
      <Switch id={id} checked={checked} disabled={disabled ?? false} onCheckedChange={onChange} />
    </div>
  )
}
