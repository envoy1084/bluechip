import { Slider as BaseSlider } from "@base-ui/react/slider"
import { type ComponentProps, useMemo, useState } from "react"
import { cn } from "../lib/cn.ts"

type SliderValue = number | ReadonlyArray<number>

export interface SliderProps
  extends Omit<ComponentProps<typeof BaseSlider.Root>, "value" | "defaultValue" | "onValueChange" | "children">
{
  /** One number for a single thumb, two for a range. */
  readonly value?: SliderValue
  readonly defaultValue?: SliderValue
  readonly onValueChange?: (value: SliderValue) => void
  /** Accessible names, one per thumb ("Lowest cash", "Highest cash"). */
  readonly thumbLabels: ReadonlyArray<string>
  /** Shows each value in a bubble above its thumb. */
  readonly showValues?: boolean
  /** Shows the formatted min and max under the track. */
  readonly showScale?: boolean
}

/**
 * Sets a number or a range by dragging or with the arrow keys (Shift or Page keys for big steps). Values are
 * formatted with `format` (`Intl.NumberFormat` options) everywhere: bubbles, scale and screen readers.
 */
export function Slider({
  value,
  defaultValue = 0,
  onValueChange,
  thumbLabels,
  showValues = true,
  showScale = true,
  min = 0,
  max = 100,
  format,
  locale,
  className,
  ...props
}: SliderProps) {
  const [uncontrolled, setUncontrolled] = useState<SliderValue>(defaultValue)
  const current = value ?? uncontrolled
  const values = typeof current === "number" ? [current] : current
  const formatter = useMemo(() => new Intl.NumberFormat(locale, format), [locale, format])

  return (
    <div data-slot="slider" className={cn("grid gap-0.5", className)}>
      <BaseSlider.Root
        value={typeof current === "number" ? current : [...current]}
        onValueChange={(next) => {
          const nextValue = typeof next === "number" ? next : [...next]
          setUncontrolled(nextValue)
          onValueChange?.(nextValue)
        }}
        min={min}
        max={max}
        format={format}
        locale={locale}
        className={cn("group/slider", showValues && "pt-[30px]")}
        {...props}
      >
        <BaseSlider.Control className="flex h-[22px] cursor-pointer touch-none items-center select-none group-data-disabled/slider:cursor-not-allowed group-data-disabled/slider:opacity-50">
          <BaseSlider.Track className="relative h-1.5 w-full rounded-[6px] bg-g-100 shadow-[inset_0_1px_1px_rgba(10,11,13,.08)]">
            <BaseSlider.Indicator className="rounded-[6px] bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] group-data-disabled/slider:bg-g-400 group-data-disabled/slider:bg-none" />
            {values.map((thumbValue, index) => (
              <BaseSlider.Thumb
                key={thumbLabels[index] ?? index}
                index={index}
                aria-label={thumbLabels[index]}
                className={cn(
                  "size-5 cursor-grab rounded-full bg-[linear-gradient(180deg,#fff,#f6f7f9)] outline-none",
                  "shadow-[0_0_0_1px_rgba(10,11,13,.14),0_1px_3px_rgba(10,11,13,.2),0_4px_10px_-2px_rgba(10,11,13,.16)]",
                  "transition-[box-shadow,scale] duration-fast ease-brand hover:scale-108",
                  "has-[:focus-visible]:shadow-[0_0_0_1px_var(--color-blue),0_0_0_5px_rgba(42, 91, 255,.16),0_2px_6px_rgba(10,11,13,.2)]",
                  "data-dragging:scale-110 data-dragging:cursor-grabbing group-data-disabled/slider:cursor-not-allowed group-data-disabled/slider:hover:scale-100"
                )}
              >
                {showValues && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 rounded-xs bg-ink px-[7px] py-0.5 text-caption font-semibold whitespace-nowrap text-white tabular-nums shadow-[0_2px_6px_rgba(10,11,13,.2)] after:absolute after:top-full after:left-1/2 after:-ml-1 after:border-4 after:border-transparent after:border-t-ink after:content-[''] group-data-disabled/slider:bg-g-500 group-data-disabled/slider:after:border-t-g-500"
                  >
                    {formatter.format(thumbValue)}
                  </span>
                )}
              </BaseSlider.Thumb>
            ))}
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
      {showScale && (
        <div aria-hidden className="flex justify-between text-[11.5px] text-g-400 tabular-nums">
          <span>{formatter.format(min)}</span>
          <span>{formatter.format(max)}</span>
        </div>
      )}
    </div>
  )
}
