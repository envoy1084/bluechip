import { type KeyboardEvent, type RefObject, useEffect, useRef, useState } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { InputGroup, InputGroupButton, InputGroupInput } from "./input-group.tsx"
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx"

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * A time of day as typed, in 24 hours: "9:30", "930", "0930" and "21" read as "09:30", "09:30", "09:30" and
 * "21:00". `null` when it isn't a time.
 */
export const parseTimeOfDay = (text: string): string | null => {
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(text.trim())
  if (match === null) return null
  const hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  return hour < 24 && minute < 60 ? `${pad(hour)}:${pad(minute)}` : null
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

// Arrow keys, Home and End move between a column's options; Tab leaves it.
const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
  const options = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button") ?? [])
  const at = options.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === "ArrowDown" ?
    at + 1 :
    event.key === "ArrowUp" ?
    at - 1 :
    event.key === "Home" ?
    0 :
    event.key === "End" ?
    options.length - 1 :
    null
  if (next === null) return
  event.preventDefault()
  options[Math.max(0, Math.min(options.length - 1, next))]?.focus()
}

function TimeColumn(
  { label, options, selected, selectedRef, onPick }: Readonly<{
    label: string
    options: ReadonlyArray<number>
    selected: number
    selectedRef?: RefObject<HTMLButtonElement | null>
    onPick: (value: number) => void
  }>
) {
  const own = useRef<HTMLButtonElement>(null)
  const ref = selectedRef ?? own
  const list = useRef<HTMLDivElement>(null)

  // Opens on the time in force, in the middle of its column.
  useEffect(() => {
    const option = ref.current
    const column = list.current
    if (option === null || column === null) return
    column.scrollTop = option.offsetTop - column.offsetTop - column.clientHeight / 2 + option.offsetHeight / 2
  }, [ref])

  return (
    <fieldset className="grid min-w-0 content-start gap-1.5">
      <legend className="pb-1.5 text-center text-caption font-medium text-g-500">{label}</legend>
      <div
        ref={list}
        className={cn(
          "grid max-h-[208px] w-16 gap-0.5 overflow-y-auto overscroll-contain rounded-md bg-g-50 p-1",
          "shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)] [scrollbar-width:none]",
          "[mask-image:linear-gradient(transparent,#000_14px,#000_calc(100%_-_14px),transparent)]"
        )}
      >
        {options.map((option) => (
          <button
            key={option}
            ref={option === selected ? ref : undefined}
            type="button"
            tabIndex={option === selected ? 0 : -1}
            aria-pressed={option === selected}
            onClick={() => onPick(option)}
            onKeyDown={moveFocus}
            className={cn(
              "h-8 shrink-0 cursor-pointer rounded-sm text-label font-medium text-g-600 tabular-nums outline-none",
              "transition-[background-color,color,box-shadow] duration-fast ease-brand hover:bg-white/70 hover:text-ink",
              "focus-visible:shadow-[0_0_0_1px_var(--color-blue),0_0_0_3px_rgba(42,91,255,.14)]",
              "aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:text-blue aria-pressed:shadow-e1",
              "aria-pressed:hover:bg-white"
            )}
          >
            {pad(option)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export interface TimePickerProps {
  /** "HH:MM", 24-hour. */
  readonly value: string
  readonly onValueChange: (value: string) => void
  /** The minutes offered in the picker; any minute can still be typed. */
  readonly step?: 5 | 10 | 15 | 30 | undefined
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
 * A time of day, 24-hour: typed in its box ("930" reads as 09:30, on Enter or leaving it; anything else goes back to
 * the time it had), or picked from hour and minute columns behind the clock. Arrow keys move in a column; picking a
 * minute closes it.
 */
export function TimePicker(
  { value, onValueChange, step = 15, id, size = "md", invalid, disabled, className, ...labels }: TimePickerProps
) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const hourRef = useRef<HTMLButtonElement>(null)

  const [hour, minute] = (parseTimeOfDay(value) ?? "00:00").split(":").map(Number) as [number, number]
  const minutes = Array.from({ length: 60 / step }, (_, index) => index * step)
  const offered = minutes.includes(minute) ? minutes : [...minutes, minute].toSorted((a, b) => a - b)

  const commit = () => {
    if (text === null) return
    const parsed = parseTimeOfDay(text)
    setText(null)
    if (parsed !== null && parsed !== value) onValueChange(parsed)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <InputGroup size={size} data-slot="time-picker" className={cn("w-[116px]", className)}>
        <InputGroupInput
          id={id}
          value={text ?? value}
          inputMode="numeric"
          autoComplete="off"
          placeholder="HH:MM"
          maxLength={5}
          disabled={disabled}
          aria-invalid={invalid === true ? true : undefined}
          className="font-medium tabular-nums"
          onChange={(event) => setText(event.currentTarget.value.replace(/[^\d:]/g, ""))}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit()
            if (event.key === "Escape") setText(null)
          }}
          {...labels}
        />
        <PopoverTrigger
          disabled={disabled}
          render={<InputGroupButton aria-label="Pick a time" className="-mr-1" />}
        >
          <Icon name="clock" />
        </PopoverTrigger>
      </InputGroup>
      <PopoverContent align="end" initialFocus={hourRef} className="w-auto gap-3 p-3">
        <p aria-hidden className="text-center text-[22px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
          {pad(hour)}:{pad(minute)}
        </p>
        <div className="flex items-start gap-2">
          <TimeColumn
            label="Hour"
            options={HOURS}
            selected={hour}
            selectedRef={hourRef}
            onPick={(next) => onValueChange(`${pad(next)}:${pad(minute)}`)}
          />
          <span aria-hidden className="self-center pt-6 text-label font-semibold text-g-400">:</span>
          <TimeColumn
            label="Minute"
            options={offered}
            selected={minute}
            onPick={(next) => {
              onValueChange(`${pad(hour)}:${pad(next)}`)
              setOpen(false)
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
