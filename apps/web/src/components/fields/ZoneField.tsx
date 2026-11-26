import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from "@bluechip/ui/components/combobox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { useId } from "react"
import { timeZones, zoneLabel } from "../../lib/timeZones.ts"

const EVERY_ZONE: ReadonlyArray<string> = Intl.supportedValuesOf("timeZone")

/**
 * A time zone, named by its city. `few` offers the market's, yours and UTC (an automation's times); `every` searches
 * every zone (your own, in Settings). Its label sits above it, or only for screen readers.
 */
export function ZoneField(
  { label, value, zone, choices = "few", disabled, labelHidden = false, onChange }: Readonly<{
    label: string
    value: string
    /** The viewer's own zone. */
    zone: string
    choices?: "few" | "every"
    disabled?: boolean
    labelHidden?: boolean
    onChange: (zone: string) => void
  }>
) {
  const id = useId()
  const zones = timeZones(zone)
  const items = [
    ...zones.map((option) => ({ value: option.zone, label: option.label })),
    ...(zones.some((option) => option.zone === value) ? [] : [{ value, label: zoneLabel(value) }])
  ]

  return (
    <div className="grid content-start gap-1.5">
      <span id={id} className={labelHidden ? "sr-only" : "text-[13.5px] font-medium whitespace-nowrap text-g-700"}>
        {label}
      </span>
      {choices === "every" ?
        (
          <Combobox
            items={EVERY_ZONE}
            value={value}
            itemToStringLabel={zoneLabel}
            onValueChange={(picked: string | null) => picked !== null && onChange(picked)}
          >
            <ComboboxInput aria-labelledby={id} placeholder="Search by city" className="w-56" disabled={disabled} />
            <ComboboxContent>
              <ComboboxEmpty>No city matches that.</ComboboxEmpty>
              <ComboboxList>
                {(option: string) => (
                  <ComboboxItem key={option} value={option}>
                    {zoneLabel(option)}
                    <span className="ml-auto text-label-sm text-g-500">{option.split("/")[0]}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) :
        (
          <Select
            items={items}
            value={value}
            disabled={disabled}
            onValueChange={(picked) => picked !== null && onChange(picked)}
          >
            <SelectTrigger size="sm" aria-labelledby={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
    </div>
  )
}
