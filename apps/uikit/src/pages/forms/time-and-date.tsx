import { DatePicker } from "@bluechip/ui/components/date-picker"
import { TimePicker } from "@bluechip/ui/components/time-picker"
import { useId, useState } from "react"
import { Demo, Section } from "./layout.tsx"

/* ---------- Time and date ---------- */

export function TimePickerSection() {
  const id = useId()
  const [time, setTime] = useState("10:00")
  const [quiet, setQuiet] = useState("22:00")
  return (
    <Section
      title="Time picker"
      purpose="A time of day, 24-hour. Type it (930 reads as 09:30) or open the clock for hour and minute columns; arrow keys move in a column and picking a minute closes it."
      base="Popover"
    >
      <Demo label="Default and small">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-time`} className="text-[13.5px] font-medium text-g-700">Time</label>
          <TimePicker id={`${id}-time`} value={time} onValueChange={setTime} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-quiet`} className="text-[13.5px] font-medium text-g-700">Quiet from</label>
          <TimePicker id={`${id}-quiet`} size="sm" step={30} value={quiet} onValueChange={setQuiet} />
        </div>
      </Demo>
      <Demo label="States">
        <TimePicker aria-label="Invalid time" invalid value="07:00" onValueChange={() => undefined} />
        <TimePicker aria-label="Disabled time" disabled value="16:00" onValueChange={() => undefined} />
      </Demo>
    </Section>
  )
}

export function DatePickerSection() {
  const id = useId()
  const [day, setDay] = useState("2026-12-31")
  return (
    <Section
      title="Date picker"
      purpose="A calendar day, said in words on its trigger, picked from a month of days. Arrow keys move a day or a week, Page Up and Page Down a month; days before the first allowed can't be picked."
      base="Popover"
    >
      <Demo label="With a first day">
        <div className="grid gap-1.5">
          <span id={`${id}-last`} className="text-[13.5px] font-medium text-g-700">Last day</span>
          <DatePicker
            aria-labelledby={`${id}-last`}
            value={day}
            min="2026-12-01"
            onValueChange={setDay}
            className="w-[200px]"
          />
        </div>
        <DatePicker aria-label="Small day" size="sm" value={day} onValueChange={setDay} className="w-[180px]" />
      </Demo>
    </Section>
  )
}
