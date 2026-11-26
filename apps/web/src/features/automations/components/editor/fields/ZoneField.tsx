import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { useId } from "react"
import { timeZones } from "../../../model/automationText.ts"

/** The time zone its times are in: the market's, yours, or UTC; its label above it. */
export function ZoneField(
  { label, value, zone, onChange }: Readonly<{
    label: string
    value: string
    /** The viewer's own zone. */
    zone: string
    onChange: (zone: string) => void
  }>
) {
  const id = useId()
  const zones = timeZones(zone)
  const items = [
    ...zones.map((option) => ({ value: option.zone, label: option.label })),
    ...(zones.some((option) => option.zone === value) ? [] : [{ value, label: value }])
  ]

  return (
    <div className="grid content-start gap-1.5">
      <span id={id} className="text-[13.5px] font-medium whitespace-nowrap text-g-700">{label}</span>
      <Select items={items} value={value} onValueChange={(picked) => picked !== null && onChange(picked)}>
        <SelectTrigger size="sm" aria-labelledby={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
