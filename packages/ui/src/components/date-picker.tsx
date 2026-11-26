import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button } from "./button.tsx"
import { inputVariants } from "./input.tsx"
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx"

// Days are calendar days, so every date here is midnight UTC: no time zone can move one to the day before.
const DAY_MS = 86_400_000

const toDay = (iso: string): number => Date.parse(`${iso}T00:00:00Z`)
const toIso = (day: number): string => new Date(day).toISOString().slice(0, 10)

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
})
const fullFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC"
})
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })

// Built from its parts: ICU versions differ on the comma after the weekday.
const inWords = (format: Intl.DateTimeFormat, day: number): string => {
  const parts = Object.fromEntries(format.formatToParts(day).map((part) => [part.type, part.value]))
  return `${parts["weekday"]} ${parts["day"]} ${parts["month"]} ${parts["year"]}`
}

/** A calendar day in words: "Sun 27 Dec 2026". */
export const formatDay = (iso: string): string => inWords(dayFormat, toDay(iso))

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** The weeks of a month, Monday first, each day as midnight UTC; `null` fills the days of the months around it. */
const weeksOf = (year: number, month: number): ReadonlyArray<ReadonlyArray<number | null>> => {
  const first = Date.UTC(year, month, 1)
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const lead = (new Date(first).getUTCDay() + 6) % 7
  const cells = Array.from(
    { length: Math.ceil((lead + days) / 7) * 7 },
    (_, index) => index < lead || index >= lead + days ? null : first + (index - lead) * DAY_MS
  )
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

const shiftMonth = (day: number, months: number): number => {
  const date = new Date(day)
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0)).getUTCDate()
  return target + (Math.min(date.getUTCDate(), last) - 1) * DAY_MS
}

export interface DatePickerProps {
  /** "YYYY-MM-DD". */
  readonly value: string
  readonly onValueChange: (value: string) => void
  /** The first day that can be picked, "YYYY-MM-DD". */
  readonly min?: string | undefined
  /** The last day that can be picked, "YYYY-MM-DD". */
  readonly max?: string | undefined
  readonly id?: string | undefined
  readonly size?: "sm" | "md" | undefined
  readonly invalid?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly "aria-label"?: string | undefined
  readonly "aria-labelledby"?: string | undefined
  readonly "aria-describedby"?: string | undefined
  readonly className?: string | undefined
}

/**
 * A calendar day: the day in words on its trigger, a month of days in its popover. Arrow keys move a day or a week,
 * Page Up and Page Down a month, Home and End to the week's ends; Enter picks the day and closes it.
 */
export function DatePicker(
  { value, onValueChange, min, max, id, size = "md", invalid, disabled, className, ...labels }: DatePickerProps
) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(() => toDay(value))
  const grid = useRef<HTMLTableElement>(null)
  const moved = useRef(false)

  const selected = toDay(value)
  const first = min === undefined ? -Infinity : toDay(min)
  const last = max === undefined ? Infinity : toDay(max)
  const shown = new Date(focused)
  const weeks = weeksOf(shown.getUTCFullYear(), shown.getUTCMonth())
  const [today] = useState(() => toDay(new Date().toLocaleDateString("en-CA")))
  const clamp = (day: number) => Math.max(first, Math.min(last, day))

  // Keyboard moves follow the focus onto the day moved to, which may be in the month just drawn.
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${toIso(focused)}"]`)?.focus()
  }, [focused])

  const move = (event: KeyboardEvent) => {
    const day = new Date(focused)
    const weekday = (day.getUTCDay() + 6) % 7
    const next = {
      ArrowLeft: focused - DAY_MS,
      ArrowRight: focused + DAY_MS,
      ArrowUp: focused - 7 * DAY_MS,
      ArrowDown: focused + 7 * DAY_MS,
      PageUp: shiftMonth(focused, -1),
      PageDown: shiftMonth(focused, 1),
      Home: focused - weekday * DAY_MS,
      End: focused + (6 - weekday) * DAY_MS
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    moved.current = true
    setFocused(clamp(next))
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setFocused(selected)
        setOpen(next)
      }}
    >
      <PopoverTrigger
        id={id}
        disabled={disabled}
        render={
          <button
            type="button"
            data-invalid={invalid === true ? "" : undefined}
            {...labels}
            data-slot="date-picker"
            className={cn(
              inputVariants({ size }),
              "inline-flex cursor-pointer items-center gap-2 text-left font-medium tabular-nums",
              className
            )}
          />
        }
      >
        <Icon name="calendar" size={15} className="shrink-0 text-g-400" />
        <span className="truncate">{formatDay(value)}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[292px] gap-2 p-3"
        initialFocus={() => grid.current?.querySelector<HTMLButtonElement>("[tabindex='0']") ?? true}
      >
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setFocused(clamp(shiftMonth(focused, -1)))}
          >
            <Icon name="chevron-left" />
          </Button>
          <span aria-live="polite" className="text-label font-semibold text-ink">{monthFormat.format(focused)}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setFocused(clamp(shiftMonth(focused, 1)))}
          >
            <Icon name="chevron-right" />
          </Button>
        </div>
        <table ref={grid} className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {WEEKDAYS.map((weekday) => (
                <th key={weekday} scope="col" className="pb-1 text-caption font-medium text-g-500">{weekday}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.find((day) => day !== null)}>
                {week.map((day, index) => (
                  <td key={day ?? `empty-${index}`} className="p-px text-center">
                    {day === null ? null : (
                      <button
                        type="button"
                        data-day={toIso(day)}
                        tabIndex={day === focused ? 0 : -1}
                        disabled={day < first || day > last}
                        aria-label={inWords(fullFormat, day)}
                        aria-pressed={day === selected}
                        aria-current={day === today ? "date" : undefined}
                        onFocus={() => setFocused(day)}
                        onKeyDown={move}
                        onClick={() => {
                          onValueChange(toIso(day))
                          setOpen(false)
                        }}
                        className={cn(
                          "grid h-9 w-full cursor-pointer place-items-center rounded-sm text-label font-medium text-g-700 tabular-nums outline-none",
                          "transition-colors duration-fast ease-brand hover:bg-g-100 hover:text-ink",
                          "focus-visible:shadow-[0_0_0_1px_var(--color-blue),0_0_0_3px_rgba(42,91,255,.14)]",
                          "aria-[current=date]:font-semibold aria-[current=date]:text-ink aria-[current=date]:underline aria-[current=date]:underline-offset-4",
                          "aria-pressed:bg-ink aria-pressed:text-white aria-pressed:hover:bg-ink",
                          "disabled:cursor-not-allowed disabled:text-g-300 disabled:hover:bg-transparent"
                        )}
                      >
                        {new Date(day).getUTCDate()}
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </PopoverContent>
    </Popover>
  )
}
