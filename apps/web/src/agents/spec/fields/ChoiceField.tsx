import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { cn } from "@bluechip/ui/lib/cn"

/** One of a few settings, each said in words. */
export function ChoiceField<A extends string | number>(
  { label, help, value, options, problem, onChange }: Readonly<{
    label: string
    help?: string | undefined
    value: A
    options: ReadonlyArray<{ readonly value: A; readonly label: string }>
    problem?: string | undefined
    onChange: (value: A) => void
  }>
) {
  const note = problem ?? help

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-medium text-g-700">{label}</span>
        <ToggleGroup
          size="sm"
          aria-label={label}
          value={[String(value)]}
          onValueChange={(values) => {
            const picked = options.find((option) => String(option.value) === values[0])
            if (picked !== undefined) onChange(picked.value)
          }}
          className="flex-wrap"
        >
          {options.map((option) => (
            <ToggleGroupItem key={option.value} value={String(option.value)}>{option.label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {note === undefined ?
        null :
        <p className={cn("text-label-sm text-g-500", problem !== undefined && "font-medium text-loss")}>{note}</p>}
    </div>
  )
}
